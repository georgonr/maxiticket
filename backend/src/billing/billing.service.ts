import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Platformová konštanta: poplatok za refundovaný/zrušený lístok (cents). 0,40 €.
// Per-organizátor override: Organizer.refundFeePerTicketCents (null = táto konštanta).
export const REFUND_FEE_PER_TICKET_CENTS = 40;

// Orders comp/manual sa nepočítajú do tržby (zhodné s MetricsModule NON_COMP).
const NON_COMP = { OR: [{ paymentProvider: null }, { paymentProvider: { notIn: ['comp', 'manual'] } }] };

export type BillingScope = { occurrenceId: string } | { from: Date; to: Date };

export interface BillingStatement {
  ticketsSold: number;
  revenueCents: number;
  commissionPercent: number;
  commissionCents: number;
  vatPercent: number;
  vatCents: number;
  refundedTickets: number;
  refundFeePerTicketCents: number;
  refundFeesCents: number;
  netPayoutCents: number;
  customerFeesCents: number; // NÁŠ príjem (zákaznícky 1% poplatok) – informatívne, NEvstupuje do payout
}

@Injectable()
export class BillingService {
  constructor(private prisma: PrismaService) {}

  /** Vyúčtovací rozpis organizátora pre rozsah (termín alebo dátumové okno). Read-only. */
  async computeStatement(organizerId: string, scope: BillingScope): Promise<BillingStatement> {
    // 1) rozsah termínov
    let terminIds: string[];
    if ('occurrenceId' in scope) {
      terminIds = [scope.occurrenceId];
    } else {
      // MONTHLY: termíny ktoré SKONČILI v rozsahu (endsAt, fallback startsAt ak endsAt chýba).
      const termins = await this.prisma.termin.findMany({
        where: {
          show: { organizerId },
          OR: [
            { endsAt: { gte: scope.from, lte: scope.to } },
            { endsAt: null, startsAt: { gte: scope.from, lte: scope.to } },
          ],
        },
        select: { id: true },
      });
      terminIds = termins.map((t) => t.id);
    }

    // 2) tržba + zákaznícke poplatky z PAID NON_COMP objednávok týchto termínov
    const orders = terminIds.length
      ? await this.prisma.order.findMany({
          where: {
            organizerId,
            status: 'PAID',
            AND: [NON_COMP],
            items: { some: { terminId: { in: terminIds } } },
          },
          select: { totalAmount: true, feeAmount: true },
        })
      : [];
    const revenueCents = Math.round(orders.reduce((s, o) => s + Number(o.totalAmount), 0) * 100);
    const customerFeesCents = Math.round(orders.reduce((s, o) => s + Number(o.feeAmount), 0) * 100);

    // 3) počty lístkov
    const ticketsSold = terminIds.length
      ? await this.prisma.ticket.count({
          where: { terminId: { in: terminIds }, status: { in: ['VALID', 'USED'] }, order: { status: 'PAID' } },
        })
      : 0;
    const refundedTickets = terminIds.length
      ? await this.prisma.ticket.count({
          where: { terminId: { in: terminIds }, status: { in: ['REFUNDED', 'CANCELLED'] } },
        })
      : 0;

    // 4) provízia / DPH / refund poplatky z organizátorovej konfigurácie
    const org = await this.prisma.organizer.findUnique({
      where: { id: organizerId },
      select: { commissionPercent: true, vatPercent: true, refundFeePerTicketCents: true },
    });
    const commissionPercent = Number(org?.commissionPercent ?? 0);
    const vatPercent = Number(org?.vatPercent ?? 0);
    const commissionCents = Math.round((revenueCents * commissionPercent) / 100);
    const vatCents = Math.round((commissionCents * vatPercent) / 100);
    const refundFeePerTicketCents = org?.refundFeePerTicketCents ?? REFUND_FEE_PER_TICKET_CENTS;
    const refundFeesCents = refundedTickets * refundFeePerTicketCents;
    const netPayoutCents = revenueCents - commissionCents - vatCents - refundFeesCents;

    return {
      ticketsSold,
      revenueCents,
      commissionPercent,
      commissionCents,
      vatPercent,
      vatCents,
      refundedTickets,
      refundFeePerTicketCents,
      refundFeesCents,
      netPayoutCents,
      customerFeesCents,
    };
  }

  /** Zoznam organizátorov s režimom + celkovou tržbou a odhadom výplaty (celé obdobie). */
  async organizersOverview() {
    const orgs = await this.prisma.organizer.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, companyName: true, billingMode: true },
    });
    const ALL: BillingScope = { from: new Date(0), to: new Date('2999-12-31') };
    const rows = await Promise.all(
      orgs.map(async (o) => {
        const st = await this.computeStatement(o.id, ALL);
        return {
          organizerId: o.id,
          name: o.name,
          companyName: o.companyName,
          billingMode: o.billingMode,
          revenueCents: st.revenueCents,
          netPayoutCents: st.netPayoutCents,
        };
      }),
    );
    return rows;
  }

  /** Minulé (skončené) termíny organizátora – pre dropdown v drill-down. */
  async pastTermins(organizerId: string) {
    const now = new Date();
    const termins = await this.prisma.termin.findMany({
      where: { show: { organizerId }, startsAt: { lte: now } },
      orderBy: { startsAt: 'desc' },
      take: 100,
      select: { id: true, startsAt: true, endsAt: true, show: { select: { name: true } } },
    });
    return termins.map((t) => ({
      id: t.id,
      startsAt: t.startsAt,
      endsAt: t.endsAt,
      showName: t.show?.name ?? null,
    }));
  }
}
