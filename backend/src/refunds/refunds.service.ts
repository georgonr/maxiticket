import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { OrderStatus, TicketStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';

/**
 * Refund flow (Úloha 20).
 *
 * RefundRequest.status: REQUESTED → APPROVED → REFUNDED  (alebo REQUESTED → REJECTED).
 * Order.status zrkadlí: PAID → REFUND_REQUESTED → REFUND_APPROVED → REFUNDED
 *   (reject vracia Order späť na PAID; RefundRequest ostáva REJECTED ako audit).
 *
 * ŽIADNE Stripe API volanie – pri stripe objednávke Geo vykoná refund manuálne
 * v Stripe dashboarde, systém len eviduje stav (manualStripeNeeded flag).
 */
@Injectable()
export class RefundsService {
  private readonly logger = new Logger(RefundsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  // ─────────────────────── CUSTOMER ───────────────────────

  /** Zákazník požiada o vrátenie pre svoju PAID objednávku. */
  async requestRefund(orderId: string, userId: string, reason: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { organizer: { select: { name: true, email: true } } },
    });
    if (!order) throw new NotFoundException('Objednávka neexistuje.');
    if (order.userId !== userId) {
      throw new ForbiddenException('Objednávka nepatrí vášmu účtu.');
    }

    // Otvorená žiadosť má prednosť pred status-checkom: duplicita → 409 (nie 400),
    // keďže prvá žiadosť už prepla Order na REFUND_REQUESTED.
    const open = await this.prisma.refundRequest.findFirst({
      where: { orderId, status: 'REQUESTED' },
    });
    if (open) {
      throw new ConflictException('Pre túto objednávku už existuje otvorená žiadosť o vrátenie.');
    }

    if (order.status !== OrderStatus.PAID) {
      throw new BadRequestException('Túto objednávku nie je možné vrátiť.');
    }

    const reasonTrim = reason.trim();

    const rr = await this.prisma.$transaction(async (tx) => {
      const created = await tx.refundRequest.create({
        data: {
          orderId,
          requestedById: userId,
          reason: reasonTrim,
          status: 'REQUESTED',
        },
      });
      await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.REFUND_REQUESTED },
      });
      return created;
    });

    // Notifikácia organizátorovi (best-effort – zlyhanie e-mailu neblokuje žiadosť).
    try {
      await this.mail.sendRefundRequested({
        to: order.organizer.email,
        orderNumber: order.orderNumber,
        buyerEmail: order.buyerEmail,
        amount: Number(order.totalAmount),
        currency: order.currency,
        reason: reasonTrim,
      });
    } catch (e) {
      this.logger.error(`Refund-request mail zlyhal (order ${order.orderNumber}): ${e}`);
    }

    return {
      refundRequestId: rr.id,
      status: rr.status,
      orderStatus: OrderStatus.REFUND_REQUESTED,
    };
  }

  // ─────────────────────── ORGANIZER / ADMIN list ───────────────────────

  /**
   * Zoznam žiadostí. `scopeOrganizerId` undefined = admin (všetky orgy),
   * inak scoped na organizátora.
   */
  async list(scopeOrganizerId: string | undefined, statusFilter?: string) {
    const where: Prisma.RefundRequestWhereInput = {};
    if (scopeOrganizerId) where.order = { organizerId: scopeOrganizerId };
    if (statusFilter && ['REQUESTED', 'APPROVED', 'REJECTED', 'REFUNDED'].includes(statusFilter)) {
      where.status = statusFilter;
    }

    const rows = await this.prisma.refundRequest.findMany({
      where,
      orderBy: { requestedAt: 'desc' },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            buyerName: true,
            buyerEmail: true,
            totalAmount: true,
            currency: true,
            paymentProvider: true,
            status: true,
            organizer: { select: { name: true } },
          },
        },
      },
    });

    return rows.map((r) => ({
      id: r.id,
      orderId: r.orderId,
      orderNumber: r.order.orderNumber,
      buyerName: r.order.buyerName,
      buyerEmail: r.order.buyerEmail,
      organizerName: r.order.organizer?.name ?? null,
      orderTotal: Number(r.order.totalAmount),
      currency: r.order.currency,
      paymentProvider: r.order.paymentProvider ?? null,
      orderStatus: r.order.status,
      reason: r.reason,
      status: r.status,
      reviewNote: r.reviewNote,
      refundAmount: r.refundAmount != null ? Number(r.refundAmount) : null,
      requestedAt: r.requestedAt,
      reviewedAt: r.reviewedAt,
      refundedAt: r.refundedAt,
    }));
  }

  // ─────────────────────── review (approve / reject) ───────────────────────

  private async loadScoped(refundId: string, scopeOrganizerId: string | undefined) {
    const rr = await this.prisma.refundRequest.findUnique({
      where: { id: refundId },
      include: {
        order: {
          include: {
            organizer: { select: { name: true, email: true } },
            user: { select: { email: true, firstName: true } },
            coupon: { select: { id: true } },
            couponRedemption: { select: { id: true } },
          },
        },
      },
    });
    if (!rr) throw new NotFoundException('Žiadosť o vrátenie neexistuje.');
    if (scopeOrganizerId && rr.order.organizerId !== scopeOrganizerId) {
      throw new ForbiddenException('Žiadosť nepatrí vašej organizácii.');
    }
    return rr;
  }

  /** Notifikačná adresa + meno zákazníka (prihlásený user, inak buyerEmail). */
  private customerContact(order: {
    buyerEmail: string;
    user: { email: string; firstName: string | null } | null;
  }) {
    return {
      to: order.user?.email ?? order.buyerEmail,
      firstName: order.user?.firstName ?? null,
    };
  }

  async review(
    refundId: string,
    reviewerId: string,
    scopeOrganizerId: string | undefined,
    action: 'approve' | 'reject',
    reviewNote?: string,
    refundAmount?: number,
  ) {
    const rr = await this.loadScoped(refundId, scopeOrganizerId);
    if (rr.status !== 'REQUESTED') {
      throw new BadRequestException('Táto žiadosť už bola spracovaná.');
    }
    const order = rr.order;
    const contact = this.customerContact(order);
    const note = reviewNote?.trim() || null;

    if (action === 'approve') {
      const amount: Prisma.Decimal | number =
        refundAmount != null ? refundAmount : order.totalAmount;
      await this.prisma.$transaction(async (tx) => {
        await tx.refundRequest.update({
          where: { id: refundId },
          data: {
            status: 'APPROVED',
            reviewedById: reviewerId,
            reviewNote: note,
            reviewedAt: new Date(),
            refundAmount: amount,
          },
        });
        await tx.order.update({
          where: { id: order.id },
          data: { status: OrderStatus.REFUND_APPROVED },
        });
      });
      try {
        await this.mail.sendRefundApproved({
          to: contact.to,
          firstName: contact.firstName,
          orderNumber: order.orderNumber,
          amount: Number(amount),
          currency: order.currency,
          manualStripe: order.paymentProvider === 'stripe',
        });
      } catch (e) {
        this.logger.error(`Refund-approved mail zlyhal (order ${order.orderNumber}): ${e}`);
      }
      return {
        id: refundId,
        status: 'APPROVED',
        orderStatus: OrderStatus.REFUND_APPROVED,
        manualStripeNeeded: order.paymentProvider === 'stripe',
      };
    }

    // reject → Order späť na PAID, RefundRequest REJECTED (audit)
    await this.prisma.$transaction(async (tx) => {
      await tx.refundRequest.update({
        where: { id: refundId },
        data: {
          status: 'REJECTED',
          reviewedById: reviewerId,
          reviewNote: note,
          reviewedAt: new Date(),
        },
      });
      await tx.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.PAID },
      });
    });
    try {
      await this.mail.sendRefundRejected({
        to: contact.to,
        firstName: contact.firstName,
        orderNumber: order.orderNumber,
        reviewNote: note,
      });
    } catch (e) {
      this.logger.error(`Refund-rejected mail zlyhal (order ${order.orderNumber}): ${e}`);
    }
    return {
      id: refundId,
      status: 'REJECTED',
      orderStatus: OrderStatus.PAID,
    };
  }

  // ─────────────────────── mark-refunded ───────────────────────

  /**
   * Označí schválenú žiadosť ako vrátenú: Order → REFUNDED, lístky zneplatnené,
   * kupón vrátený do obehu. ŽIADNE Stripe API volanie.
   */
  async markRefunded(refundId: string, scopeOrganizerId: string | undefined) {
    const rr = await this.loadScoped(refundId, scopeOrganizerId);
    if (rr.status !== 'APPROVED') {
      throw new BadRequestException('Vrátiť možno len schválenú žiadosť.');
    }
    const order = rr.order;
    const amount: Prisma.Decimal | number =
      rr.refundAmount != null ? rr.refundAmount : order.totalAmount;

    let couponReturned = false;

    await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      await tx.refundRequest.update({
        where: { id: refundId },
        data: { status: 'REFUNDED', refundedAt: now, refundAmount: amount },
      });
      await tx.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.REFUNDED, refundedAt: now },
      });
      // Zneplatni len ešte platné/použité lístky (idempotencia, neprepíš už CANCELLED).
      await tx.ticket.updateMany({
        where: {
          orderId: order.id,
          status: { in: [TicketStatus.VALID, TicketStatus.USED] },
        },
        data: { status: TicketStatus.REFUNDED },
      });
      // Vráť kupón do obehu (usedCount-- + zmaž redemption).
      if (order.couponId && order.couponRedemption) {
        await tx.coupon.update({
          where: { id: order.couponId },
          data: { usedCount: { decrement: 1 } },
        });
        await tx.couponRedemption.delete({ where: { id: order.couponRedemption.id } });
        couponReturned = true;
      }
    });

    const manualStripeNeeded = order.paymentProvider === 'stripe';
    this.logger.log(
      `Order ${order.orderNumber} REFUNDED (provider=${order.paymentProvider}, manualStripe=${manualStripeNeeded}, couponReturned=${couponReturned})`,
    );

    return {
      id: refundId,
      status: 'REFUNDED',
      orderStatus: OrderStatus.REFUNDED,
      refundAmount: Number(amount),
      manualStripeNeeded,
      couponReturned,
    };
  }
}
