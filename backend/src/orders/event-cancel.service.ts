import {
  Injectable, NotFoundException, ForbiddenException, ConflictException, Logger,
} from '@nestjs/common';
import { OrderStatus, TicketStatus, TerminStatus, SeatStatus, UserRole, EventStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { mailMessages, normalizeMailLocale } from '../mail/mail-i18n';
import { JwtPayload } from '../casl/casl-ability.factory';

/**
 * Krok 27: zrušenie JEDNÉHO termínu (occurrence).
 * Atomicky: Termin→CANCELLED, lístky→CANCELLED (scanner odmietne), TerminSeat→AVAILABLE,
 * objednávky→refund/cancel stav. E-maily až PO commite (best-effort, nerollbackujú).
 */
@Injectable()
export class EventCancelService {
  private readonly logger = new Logger(EventCancelService.name);

  constructor(private prisma: PrismaService, private mail: MailService) {}

  private isSuperOrStaff(user: JwtPayload): boolean {
    return user.role === UserRole.SUPERADMIN || user.role === UserRole.STAFF;
  }

  // Krok 31e1: lokalizovaný info text o refunde podľa Order.locale + platobnej brány.
  private refundInfo(provider: string | null, locale: string): string {
    const r = mailMessages[normalizeMailLocale(locale)].terminCancelled.refundInfo;
    if (provider === 'stripe') return r.stripe;
    if (provider === 'pos_cash' || provider === 'pos_card') return r.pos;
    if (provider === 'comp') return r.comp;
    return r.default;
  }

  async cancelOccurrence(eventId: string, occurrenceId: string, user: JwtPayload) {
    const termin = await this.prisma.termin.findUnique({
      where: { id: occurrenceId },
      include: { show: { select: { id: true, name: true, organizerId: true } } },
    });
    if (!termin || termin.showId !== eventId) throw new NotFoundException('Termín neexistuje.');
    if (!this.isSuperOrStaff(user) && termin.show.organizerId !== user.organizerId) {
      throw new ForbiddenException('Toto podujatie nepatrí vašej organizácii.');
    }
    if (termin.status === TerminStatus.CANCELLED) {
      throw new ConflictException('Termín je už zrušený.');
    }

    // Kupujúci na notifikáciu – zachytíme PRED transakciou (zaplatené / v refunde, NIE nezaplatené koše).
    const buyers = await this.prisma.order.findMany({
      where: {
        items: { some: { terminId: occurrenceId } },
        status: { in: [OrderStatus.PAID, OrderStatus.REFUND_REQUESTED, OrderStatus.REFUND_APPROVED] },
      },
      select: { id: true, orderNumber: true, buyerEmail: true, paymentProvider: true, locale: true },
    });

    const ownsTermin = { items: { some: { terminId: occurrenceId } } };

    // ── Atomická mutácia ──────────────────────────────────────────────────────
    await this.prisma.$transaction(async (tx) => {
      // a) zastav predaj
      await tx.termin.update({ where: { id: occurrenceId }, data: { status: TerminStatus.CANCELLED } });
      // b) zneplatni lístky (scanner odmietne CANCELLED); REFUNDED neprepisuj
      await tx.ticket.updateMany({
        where: { terminId: occurrenceId, status: { in: [TicketStatus.VALID, TicketStatus.USED] } },
        data: { status: TicketStatus.CANCELLED },
      });
      // c) uvoľni sedadlá (SEATED)
      await tx.terminSeat.updateMany({
        where: { terminId: occurrenceId, status: { in: [SeatStatus.HELD, SeatStatus.SOLD] } },
        data: { status: SeatStatus.AVAILABLE, orderId: null, orderItemId: null, heldAt: null },
      });
      // d) objednávky → refund / cancel stav
      // stripe + POS PAID → REFUND_PENDING (manuálny refund)
      await tx.order.updateMany({
        where: { ...ownsTermin, status: OrderStatus.PAID, paymentProvider: { in: ['stripe', 'pos_cash', 'pos_card'] } },
        data: { status: OrderStatus.REFUND_PENDING },
      });
      // comp / free (vrátane mock) PAID → CANCELLED (bez refundu)
      await tx.order.updateMany({
        where: { ...ownsTermin, status: OrderStatus.PAID, paymentProvider: { in: ['comp', 'mock'] } },
        data: { status: OrderStatus.CANCELLED },
      });
      // rozpracované žiadosti termínu → REFUND_PENDING (subsumované zrušením)
      await tx.order.updateMany({
        where: { ...ownsTermin, status: { in: [OrderStatus.REFUND_REQUESTED, OrderStatus.REFUND_APPROVED] } },
        data: { status: OrderStatus.REFUND_PENDING },
      });
      // nezaplatené koše (PENDING) → CANCELLED
      await tx.order.updateMany({
        where: { ...ownsTermin, status: OrderStatus.PENDING },
        data: { status: OrderStatus.CANCELLED },
      });
    });

    // ── E-maily PO commite (best-effort; zlyhanie NESMIE rollbacknúť zrušenie) ──
    let emailsSent = 0;
    for (const o of buyers) {
      try {
        await this.mail.sendTerminCancelled({
          to: o.buyerEmail,
          locale: o.locale,
          showName: termin.show.name,
          startsAt: termin.startsAt,
          timezone: termin.timezone,
          orderNumber: o.orderNumber,
          refundInfo: this.refundInfo(o.paymentProvider, o.locale),
        });
        emailsSent++;
      } catch (e: any) {
        this.logger.error(`Cancel email failed for order ${o.orderNumber}: ${e.message}`);
      }
    }

    return {
      occurrenceId,
      status: TerminStatus.CANCELLED,
      orderCount: buyers.length,
      emailsSent,
    };
  }

  /** Poplatok za spracovanie zrušenia – odráta sa zo sumy refundu (€/lístok). */
  private static readonly CANCEL_FEE_PER_TICKET = 0.4;
  private static readonly REFUNDABLE_PROVIDERS = ['stripe', 'pos_cash', 'pos_card'];

  /**
   * Event-level zrušenie: organizer ŽIADA, SUPERADMIN VYKONÁ (guard na controlleri).
   * Zruší CELÉ podujatie (všetky termíny), zneplatní lístky, uvoľní sedadlá a
   * hromadne označí objednávky na refund (REFUND_PENDING) / cancel. Refund je
   * v platforme manuálny (Stripe Dashboard) – tu počítame NET sumu po odčítaní
   * poplatku 0,40 €/lístok a notifikujeme zákazníkov.
   */
  async cancelEvent(eventId: string, user: JwtPayload, reason?: string) {
    const show = await this.prisma.show.findUnique({
      where: { id: eventId },
      select: { id: true, name: true, organizerId: true, status: true },
    });
    if (!show) throw new NotFoundException('Podujatie neexistuje.');
    if (show.status === EventStatus.CANCELLED) {
      throw new ConflictException('Podujatie je už zrušené.');
    }

    // Scope: všetky objednávky naprieč termínmi tohto podujatia.
    const ownsShow = { items: { some: { termin: { showId: eventId } } } };

    // Kupujúci na notifikáciu + výpočet refundu – zachytíme PRED transakciou
    // (zaplatené / v refunde; NIE nezaplatené koše).
    const buyers = await this.prisma.order.findMany({
      where: {
        ...ownsShow,
        status: { in: [OrderStatus.PAID, OrderStatus.REFUND_REQUESTED, OrderStatus.REFUND_APPROVED] },
      },
      select: {
        id: true, orderNumber: true, buyerEmail: true, paymentProvider: true,
        locale: true, totalAmount: true, currency: true,
      },
    });

    // Počet zneplatnených lístkov na objednávku (pre poplatok 0,40 €/lístok).
    const orderIds = buyers.map((b) => b.id);
    const ticketGroups = orderIds.length
      ? await this.prisma.ticket.groupBy({
          by: ['orderId'],
          where: {
            orderId: { in: orderIds },
            termin: { showId: eventId },
            status: { in: [TicketStatus.VALID, TicketStatus.USED] },
          },
          _count: { _all: true },
        })
      : [];
    const ticketCountByOrder = new Map(ticketGroups.map((g) => [g.orderId, g._count._all]));

    // Refundovateľné = stripe/POS (comp/mock sa nevracia). NET = total − 0,40 €·lístky (≥ 0).
    let refundedCount = 0;
    let totalRefunded = 0;
    for (const o of buyers) {
      if (o.paymentProvider && EventCancelService.REFUNDABLE_PROVIDERS.includes(o.paymentProvider)) {
        const tickets = ticketCountByOrder.get(o.id) ?? 0;
        const net = Math.max(
          0,
          Number(o.totalAmount) - EventCancelService.CANCEL_FEE_PER_TICKET * tickets,
        );
        refundedCount++;
        totalRefunded += net;
      }
    }
    totalRefunded = Math.round(totalRefunded * 100) / 100;

    // ── Atomická mutácia ──────────────────────────────────────────────────────
    await this.prisma.$transaction(async (tx) => {
      // a) podujatie → CANCELLED + audit (kto/kedy/prečo)
      await tx.show.update({
        where: { id: eventId },
        data: {
          status: EventStatus.CANCELLED,
          cancelledAt: new Date(),
          cancelledByUserId: user.sub,
          cancellationReason: reason?.trim() || null,
        },
      });
      // b) všetky termíny podujatia → CANCELLED (zastav predaj)
      await tx.termin.updateMany({
        where: { showId: eventId, status: { not: TerminStatus.CANCELLED } },
        data: { status: TerminStatus.CANCELLED },
      });
      // c) zneplatni lístky (scanner odmietne CANCELLED; REFUNDED neprepisuj)
      await tx.ticket.updateMany({
        where: { termin: { showId: eventId }, status: { in: [TicketStatus.VALID, TicketStatus.USED] } },
        data: { status: TicketStatus.CANCELLED },
      });
      // d) uvoľni sedadlá
      await tx.terminSeat.updateMany({
        where: { termin: { showId: eventId }, status: { in: [SeatStatus.HELD, SeatStatus.SOLD] } },
        data: { status: SeatStatus.AVAILABLE, orderId: null, orderItemId: null, heldAt: null },
      });
      // e) objednávky → refund / cancel stav (rovnaká logika ako termin-cancel)
      await tx.order.updateMany({
        where: { ...ownsShow, status: OrderStatus.PAID, paymentProvider: { in: EventCancelService.REFUNDABLE_PROVIDERS } },
        data: { status: OrderStatus.REFUND_PENDING },
      });
      await tx.order.updateMany({
        where: { ...ownsShow, status: OrderStatus.PAID, paymentProvider: { in: ['comp', 'mock'] } },
        data: { status: OrderStatus.CANCELLED },
      });
      await tx.order.updateMany({
        where: { ...ownsShow, status: { in: [OrderStatus.REFUND_REQUESTED, OrderStatus.REFUND_APPROVED] } },
        data: { status: OrderStatus.REFUND_PENDING },
      });
      await tx.order.updateMany({
        where: { ...ownsShow, status: OrderStatus.PENDING },
        data: { status: OrderStatus.CANCELLED },
      });
    });

    // ── E-maily PO commite (best-effort; zlyhanie NESMIE rollbacknúť zrušenie) ──
    let emailsSent = 0;
    for (const o of buyers) {
      try {
        await this.mail.sendShowCancelled({
          to: o.buyerEmail,
          locale: o.locale,
          showName: show.name,
          orderNumber: o.orderNumber,
          refundInfo: this.refundInfo(o.paymentProvider, o.locale),
        });
        emailsSent++;
      } catch (e: any) {
        this.logger.error(`Show-cancel email failed for order ${o.orderNumber}: ${e.message}`);
      }
    }

    return {
      eventId,
      status: EventStatus.CANCELLED,
      cancelledCount: buyers.length, // dotknuté objednávky (zákazníci)
      refundedCount,                 // z toho pôjde na (manuálny) refund
      totalRefunded,                 // súčet NET súm po poplatku 0,40 €/lístok
      emailsSent,
    };
  }

  /**
   * Organizer žiada o zrušenie podujatia (nevykonáva refund – len zaznamená žiadosť,
   * SUPERADMIN ju potom vykoná cez cancelEvent). Idempotentné pri opakovaní.
   */
  async requestEventCancel(eventId: string, user: JwtPayload) {
    const show = await this.prisma.show.findUnique({
      where: { id: eventId },
      select: { id: true, organizerId: true, status: true, cancelRequestedAt: true },
    });
    if (!show) throw new NotFoundException('Podujatie neexistuje.');
    if (!this.isSuperOrStaff(user) && show.organizerId !== user.organizerId) {
      throw new ForbiddenException('Toto podujatie nepatrí vašej organizácii.');
    }
    if (show.status === EventStatus.CANCELLED) {
      throw new ConflictException('Podujatie je už zrušené.');
    }
    await this.prisma.show.update({
      where: { id: eventId },
      data: { cancelRequestedAt: new Date(), cancelRequestedById: user.sub },
    });
    return { eventId, cancelRequested: true };
  }
}
