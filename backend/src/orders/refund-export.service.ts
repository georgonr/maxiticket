import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { OrderStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from '../casl/casl-ability.factory';

/**
 * Úloha 26 + krok 27: CSV export platieb na manuálny refund.
 * Dve sekcie: STRIPE (refund cez Dashboard) + POS (hotovosť/karta – refunduje organizátor ručne).
 * comp/free do refundu nepatria. Zahŕňa PAID aj REFUND_PENDING (po zrušení termínu).
 */
@Injectable()
export class RefundExportService {
  constructor(private prisma: PrismaService) {}

  private isSuperOrStaff(user: JwtPayload): boolean {
    return user.role === UserRole.SUPERADMIN || user.role === UserRole.STAFF;
  }

  async exportCsv(eventId: string, occurrenceId: string | undefined, user: JwtPayload) {
    const show = await this.prisma.show.findUnique({
      where: { id: eventId },
      select: { id: true, organizerId: true, slug: true },
    });
    if (!show) throw new NotFoundException('Podujatie neexistuje.');
    if (!this.isSuperOrStaff(user) && show.organizerId !== user.organizerId) {
      throw new ForbiddenException('Toto podujatie nepatrí vašej organizácii.');
    }

    // Platby na refund: zaplatené alebo čakajúce na refund (po zrušení). comp/mock vylúčené.
    const orders = await this.prisma.order.findMany({
      where: {
        status: { in: [OrderStatus.PAID, OrderStatus.REFUND_PENDING] },
        paymentProvider: { in: ['stripe', 'pos_cash', 'pos_card'] },
        items: {
          some: { termin: { showId: eventId, ...(occurrenceId ? { id: occurrenceId } : {}) } },
        },
      },
      select: {
        orderNumber: true,
        buyerEmail: true,
        paymentProvider: true,
        paymentRef: true,
        totalAmount: true,
        currency: true,
        paidAt: true,
        status: true,
      },
      orderBy: { paidAt: 'asc' },
    });

    const stripe = orders.filter((o) => o.paymentProvider === 'stripe');
    const pos = orders.filter((o) => o.paymentProvider === 'pos_cash' || o.paymentProvider === 'pos_card');

    const lines: string[] = [];
    // Sekcia 1 – STRIPE (refund cez Dashboard podľa paymentIntentId)
    lines.push('# STRIPE (refund cez Stripe Dashboard)');
    lines.push(['orderRef', 'buyerEmail', 'paymentIntentId', 'amount', 'currency', 'paidAt', 'status'].join(','));
    for (const o of stripe) {
      lines.push([
        o.orderNumber, o.buyerEmail, o.paymentRef ?? '',
        Number(o.totalAmount).toFixed(2), o.currency,
        o.paidAt ? o.paidAt.toISOString() : '', o.status,
      ].map(csvCell).join(','));
    }
    // Sekcia 2 – POS (hotovosť/karta – refunduje organizátor ručne)
    lines.push('');
    lines.push('# POS – HOTOVOSŤ/KARTA (refunduje organizátor ručne)');
    lines.push(['orderRef', 'buyerEmail', 'paymentMethod', 'amount', 'currency', 'paidAt', 'status'].join(','));
    for (const o of pos) {
      lines.push([
        o.orderNumber, o.buyerEmail, o.paymentProvider ?? '',
        Number(o.totalAmount).toFixed(2), o.currency,
        o.paidAt ? o.paidAt.toISOString() : '', o.status,
      ].map(csvCell).join(','));
    }

    const csv = lines.join('\r\n') + '\r\n';
    const suffix = occurrenceId ? `${show.slug}-${occurrenceId}` : show.slug;
    return { filename: `refund-export-${suffix}.csv`, csv, count: orders.length };
  }
}

/** RFC4180-safe escape: obal do úvodzoviek ak obsahuje , " CR alebo LF; zdvojí úvodzovky. */
function csvCell(value: string): string {
  const v = String(value ?? '');
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}
