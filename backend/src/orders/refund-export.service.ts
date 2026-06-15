import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { OrderStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from '../casl/casl-ability.factory';

/** Úloha 26: CSV export platieb na manuálny refund (Stripe Dashboard) pri zrušení podujatia. */
@Injectable()
export class RefundExportService {
  constructor(private prisma: PrismaService) {}

  private isSuperOrStaff(user: JwtPayload): boolean {
    return user.role === UserRole.SUPERADMIN || user.role === UserRole.STAFF;
  }

  /** Vráti { filename, csv }. Len ADMIN/STAFF alebo ORGANIZER ktorý vlastní podujatie. */
  async exportCsv(eventId: string, occurrenceId: string | undefined, user: JwtPayload) {
    const show = await this.prisma.show.findUnique({
      where: { id: eventId },
      select: { id: true, organizerId: true, slug: true },
    });
    if (!show) throw new NotFoundException('Podujatie neexistuje.');
    if (!this.isSuperOrStaff(user) && show.organizerId !== user.organizerId) {
      throw new ForbiddenException('Toto podujatie nepatrí vašej organizácii.');
    }

    // Len reálne zaplatené Stripe platby (na refund cez Stripe Dashboard).
    const orders = await this.prisma.order.findMany({
      where: {
        status: OrderStatus.PAID,
        paymentProvider: 'stripe',
        items: {
          some: { termin: { showId: eventId, ...(occurrenceId ? { id: occurrenceId } : {}) } },
        },
      },
      select: {
        orderNumber: true,
        buyerEmail: true,
        paymentRef: true,
        totalAmount: true,
        currency: true,
        paidAt: true,
        status: true,
      },
      orderBy: { paidAt: 'asc' },
    });

    const header = ['orderRef', 'buyerEmail', 'paymentIntentId', 'amount', 'currency', 'paidAt', 'status'];
    const rows = orders.map((o) => [
      o.orderNumber,
      o.buyerEmail,
      o.paymentRef ?? '',
      Number(o.totalAmount).toFixed(2), // hlavná mena (EUR), nie centy
      o.currency,
      o.paidAt ? o.paidAt.toISOString() : '',
      o.status,
    ]);

    const csv = [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
    const suffix = occurrenceId ? `${show.slug}-${occurrenceId}` : show.slug;
    return { filename: `refund-export-${suffix}.csv`, csv, count: orders.length };
  }
}

/** RFC4180-safe escape: obal do úvodzoviek ak obsahuje , " CR alebo LF; zdvojí úvodzovky. */
function csvCell(value: string): string {
  const v = String(value ?? '');
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}
