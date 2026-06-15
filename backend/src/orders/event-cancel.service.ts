import {
  Injectable, NotFoundException, ForbiddenException, ConflictException, Logger,
} from '@nestjs/common';
import { OrderStatus, TicketStatus, TerminStatus, SeatStatus, UserRole } from '@prisma/client';
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
}
