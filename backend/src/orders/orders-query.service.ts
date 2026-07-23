import {
  Injectable, NotFoundException, ForbiddenException, BadRequestException,
} from '@nestjs/common';
import { codedNotFound, codedForbidden, codedBadRequest } from '../common/errors/coded-exception';
import { Prisma, OrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { generateReceiptPdf } from './account-receipt-pdf.helper';

const PAYMENT_LABEL: Record<string, string> = {
  stripe: 'Stripe (online platba)',
  pos_cash: 'Hotovosť (pokladňa)',
  pos_card: 'Karta (pokladňa)',
  comp: 'Zdarma',
  manual: 'Manuálna platba',
  mock: 'Test',
};

export type OrderSort =
  | 'createdAt_desc'
  | 'createdAt_asc'
  | 'totalAmount_desc'
  | 'totalAmount_asc';

export interface ListOrdersQuery {
  status?: string;
  organizerId?: string;
  showId?: string;
  paymentProvider?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
  sort?: string;
  undelivered?: string;  // '1'/'true' → len PAID s nedoručenými lístkami (krok 48)
}

// MUSÍ sedieť s MAX_ATTEMPTS v OrdersService.retryTicketDelivery.
const MAX_TICKET_EMAIL_ATTEMPTS = 5;

export type TicketsDelivery = 'delivered' | 'failed' | 'retrying' | 'unknown' | 'na';

/** Odvodí stav doručenia lístkov z uložených polí (krok 48). */
export function ticketsDeliveryStatus(o: {
  status: OrderStatus;
  ticketsEmailedAt: Date | null;
  ticketsEmailAttempts: number;
}): TicketsDelivery {
  if (o.status !== OrderStatus.PAID) return 'na';        // lístky sa posielajú len po PAID
  if (o.ticketsEmailedAt) return 'delivered';            // úspešne odoslané
  if (o.ticketsEmailAttempts === 0) return 'unknown';    // stará objednávka pred krokom 48
  return o.ticketsEmailAttempts >= MAX_TICKET_EMAIL_ATTEMPTS ? 'failed' : 'retrying';
}

const LIST_SELECT = {
  id: true,
  orderNumber: true,
  status: true,
  totalAmount: true,
  discountAmount: true,
  paymentProvider: true,
  buyerName: true,
  buyerEmail: true,
  userId: true,
  createdAt: true,
  ticketsEmailedAt: true,
  ticketsEmailError: true,
  ticketsEmailAttempts: true,
  organizer: { select: { name: true } },
  coupon: { select: { code: true } },
  _count: { select: { tickets: true } },
  items: { select: { termin: { select: { show: { select: { name: true } } } } } },
} satisfies Prisma.OrderSelect;

const DETAIL_SELECT = {
  id: true,
  orderNumber: true,
  status: true,
  currency: true,
  totalAmount: true,
  discountAmount: true,
  feeAmount: true,
  paymentProvider: true,
  paymentRef: true,
  paidAt: true,
  refundedAt: true,
  ticketsEmailedAt: true,
  ticketsEmailError: true,
  ticketsEmailAttempts: true,
  ekasaStatus: true,
  ekasaReceiptNumber: true,
  ekasaReceiptId: true,
  ekasaOkp: true,
  ekasaError: true,
  createdAt: true,
  organizerId: true,
  buyerName: true,
  buyerEmail: true,
  buyerPhone: true,
  userId: true,
  organizer: { select: { name: true } },
  coupon: { select: { code: true } },
  user: { select: { email: true } },
  items: {
    select: {
      id: true,
      quantity: true,
      unitPrice: true,
      ticketType: { select: { name: true } },
      termin: {
        select: {
          startsAt: true,
          show: { select: { name: true } },
        },
      },
    },
  },
  tickets: {
    select: { id: true, status: true },
    orderBy: { id: 'asc' as const },
  },
  refundRequests: {
    select: {
      id: true, status: true, reason: true, reviewNote: true,
      refundAmount: true, requestedAt: true, reviewedAt: true, refundedAt: true,
    },
    orderBy: { requestedAt: 'desc' as const },
  },
} satisfies Prisma.OrderSelect;

@Injectable()
export class OrdersQueryService {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(query: ListOrdersQuery, forcedOrganizerId?: string): Prisma.OrderWhereInput {
    const where: Prisma.OrderWhereInput = {};

    // Organizer caller → vždy scoped na vlastný org; admin → voliteľný filter.
    const orgId = forcedOrganizerId ?? query.organizerId;
    if (orgId) where.organizerId = orgId;

    if (query.status && this.isValidStatus(query.status)) {
      where.status = query.status as OrderStatus;
    }
    if (query.paymentProvider) where.paymentProvider = query.paymentProvider;
    if (query.showId) where.items = { some: { termin: { showId: query.showId } } };

    // Filter „nedoručené lístky" (krok 48): PAID objednávky, kde odoslanie zlyhalo
    // (aspoň jeden pokus, ešte neodoslané). Vynúti status=PAID (prepíše prípadný status filter).
    if (query.undelivered === '1' || query.undelivered === 'true') {
      where.status = OrderStatus.PAID;
      where.ticketsEmailedAt = null;
      where.ticketsEmailAttempts = { gte: 1 };
    }

    if (query.search) {
      const s = query.search.trim();
      if (s) {
        where.OR = [
          { orderNumber: { contains: s, mode: 'insensitive' } },
          { buyerEmail: { contains: s, mode: 'insensitive' } },
          { buyerName: { contains: s, mode: 'insensitive' } },
        ];
      }
    }

    const dateFilter: Prisma.DateTimeFilter = {};
    if (query.dateFrom) {
      const d = new Date(query.dateFrom);
      if (!Number.isNaN(d.getTime())) dateFilter.gte = d;
    }
    if (query.dateTo) {
      const d = new Date(query.dateTo);
      if (!Number.isNaN(d.getTime())) {
        // dateTo je deň → zahrň celý deň
        d.setHours(23, 59, 59, 999);
        dateFilter.lte = d;
      }
    }
    if (dateFilter.gte || dateFilter.lte) where.createdAt = dateFilter;

    return where;
  }

  private isValidStatus(s: string): boolean {
    return (Object.values(OrderStatus) as string[]).includes(s);
  }

  private orderBy(sort?: string): Prisma.OrderOrderByWithRelationInput {
    switch (sort as OrderSort) {
      case 'createdAt_asc':
        return { createdAt: 'asc' };
      case 'totalAmount_desc':
        return { totalAmount: 'desc' };
      case 'totalAmount_asc':
        return { totalAmount: 'asc' };
      case 'createdAt_desc':
      default:
        return { createdAt: 'desc' };
    }
  }

  async list(query: ListOrdersQuery, forcedOrganizerId?: string) {
    const limit = Math.min(Math.max(Number(query.limit) || 25, 1), 100);
    const offset = Math.max(Number(query.offset) || 0, 0);
    const where = this.buildWhere(query, forcedOrganizerId);

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: this.orderBy(query.sort),
        select: LIST_SELECT,
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      items: rows.map((o) => {
        const names = [
          ...new Set(o.items.map((i) => i.termin?.show?.name).filter(Boolean) as string[]),
        ];
        return {
          orderId: o.id,
          orderNumber: o.orderNumber,
          status: o.status,
          totalAmount: Number(o.totalAmount),
          discountAmount: Number(o.discountAmount),
          couponCode: o.coupon?.code ?? null,
          paymentProvider: o.paymentProvider ?? null,
          buyerName: o.buyerName,
          buyerEmail: o.buyerEmail,
          isGuest: o.userId == null,
          organizerName: o.organizer?.name ?? null,
          showTitles: names.slice(0, 2),
          extraShows: Math.max(0, names.length - 2),
          ticketCount: o._count.tickets,
          createdAt: o.createdAt,
          ticketsDelivery: ticketsDeliveryStatus(o),
          ticketsEmailError: o.ticketsEmailError ?? null,
        };
      }),
      total,
      limit,
      offset,
    };
  }

  async detail(id: string, forcedOrganizerId?: string) {
    const o = await this.prisma.order.findUnique({ where: { id }, select: DETAIL_SELECT });
    if (!o) throw new NotFoundException('Objednávka neexistuje.');
    if (forcedOrganizerId && o.organizerId !== forcedOrganizerId) {
      throw new ForbiddenException('Objednávka nepatrí vašej organizácii.');
    }

    return {
      orderId: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      currency: o.currency,
      totalAmount: Number(o.totalAmount),
      discountAmount: Number(o.discountAmount),
      feeAmount: Number(o.feeAmount),
      paymentProvider: o.paymentProvider ?? null,
      paymentRef: o.paymentRef ?? null,
      paidAt: o.paidAt,
      refundedAt: o.refundedAt,
      ticketsDelivery: ticketsDeliveryStatus(o),
      ticketsEmailedAt: o.ticketsEmailedAt,
      ticketsEmailError: o.ticketsEmailError ?? null,
      ticketsEmailAttempts: o.ticketsEmailAttempts,
      ekasaStatus: o.ekasaStatus,
      ekasaReceiptNumber: o.ekasaReceiptNumber ?? null,
      ekasaReceiptId: o.ekasaReceiptId ?? null,
      ekasaOkp: o.ekasaOkp ?? null,
      ekasaError: o.ekasaError ?? null,
      createdAt: o.createdAt,
      organizerName: o.organizer?.name ?? null,
      couponCode: o.coupon?.code ?? null,
      buyerName: o.buyerName,
      buyerEmail: o.buyerEmail,
      buyerPhone: o.buyerPhone,
      isGuest: o.userId == null,
      userEmail: o.user?.email ?? null,
      items: o.items.map((i) => ({
        showTitle: i.termin?.show?.name ?? null,
        terminStartsAt: i.termin?.startsAt ?? null,
        ticketTypeName: i.ticketType?.name ?? null,
        quantity: i.quantity,
        unitPrice: Number(i.unitPrice),
        lineTotal: Number(i.unitPrice) * i.quantity,
      })),
      tickets: o.tickets.map((t) => ({
        ticketId: t.id,
        codeSuffix: t.id.slice(-4).toUpperCase(),
        status: t.status,
      })),
      // Refund história (Úloha 20) – read-only pre organizer/admin detail.
      refundRequests: o.refundRequests.map((r) => ({
        id: r.id,
        status: r.status,
        reason: r.reason,
        reviewNote: r.reviewNote,
        refundAmount: r.refundAmount != null ? Number(r.refundAmount) : null,
        requestedAt: r.requestedAt,
        reviewedAt: r.reviewedAt,
        refundedAt: r.refundedAt,
      })),
    };
  }

  // ── Account (zákaznícka história – striktne userId-scoped) ───────────────────

  /** Zoznam vlastných objednávok prihláseného používateľa (Order.userId == userId). */
  async accountList(userId: string, query: { limit?: number; offset?: number }) {
    const limit = Math.min(Math.max(Number(query.limit) || 25, 1), 100);
    const offset = Math.max(Number(query.offset) || 0, 0);
    const where: Prisma.OrderWhereInput = { userId };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, orderNumber: true, status: true, totalAmount: true,
          discountAmount: true, createdAt: true,
          coupon: { select: { code: true } },
          _count: { select: { tickets: true } },
          items: { select: { termin: { select: { show: { select: { name: true } } } } } },
        },
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      items: rows.map((o) => {
        const names = [...new Set(o.items.map((i) => i.termin?.show?.name).filter(Boolean) as string[])];
        return {
          orderId: o.id,
          orderNumber: o.orderNumber,
          status: o.status,
          totalAmount: Number(o.totalAmount),
          discountAmount: Number(o.discountAmount),
          couponCode: o.coupon?.code ?? null,
          showTitles: names.slice(0, 2),
          extraShows: Math.max(0, names.length - 2),
          ticketCount: o._count.tickets,
          createdAt: o.createdAt,
        };
      }),
      total,
      limit,
      offset,
    };
  }

  private async loadOwnOrder(orderId: string, userId: string) {
    const o = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        coupon: { select: { code: true } },
        items: {
          include: {
            ticketType: { select: { name: true } },
            termin: {
              select: { startsAt: true, show: { select: { name: true } }, venue: { select: { name: true, city: true } } },
            },
          },
        },
        tickets: { select: { id: true, status: true, qrToken: true }, orderBy: { id: 'asc' } },
        refundRequests: {
          select: {
            id: true, status: true, reason: true, reviewNote: true,
            refundAmount: true, requestedAt: true, reviewedAt: true, refundedAt: true,
          },
          orderBy: { requestedAt: 'desc' },
        },
      },
    });
    if (!o) throw codedNotFound('ORDER_NOT_FOUND', 'Objednávka neexistuje.');
    if (o.userId !== userId) throw codedForbidden('ORDER_NOT_YOURS', 'Objednávka nepatrí vášmu účtu.');
    return o;
  }

  /** Detail vlastnej objednávky – vrátane qrToken (vlastník lístka ho smie zobraziť). */
  async accountDetail(orderId: string, userId: string) {
    const o = await this.loadOwnOrder(orderId, userId);
    return {
      orderId: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      currency: o.currency,
      totalAmount: Number(o.totalAmount),
      discountAmount: Number(o.discountAmount),
      feeAmount: Number(o.feeAmount),
      couponCode: o.coupon?.code ?? null,
      paymentProvider: o.paymentProvider ?? null,
      buyerName: o.buyerName,
      buyerEmail: o.buyerEmail,
      buyerPhone: o.buyerPhone,
      createdAt: o.createdAt,
      paidAt: o.paidAt,
      items: o.items.map((i) => ({
        showTitle: i.termin?.show?.name ?? null,
        venueName: i.termin?.venue?.name ?? null,
        venueCity: i.termin?.venue?.city ?? null,
        terminStartsAt: i.termin?.startsAt ?? null,
        ticketTypeName: i.ticketType?.name ?? null,
        quantity: i.quantity,
        unitPrice: Number(i.unitPrice),
        lineTotal: Number(i.unitPrice) * i.quantity,
      })),
      tickets: o.tickets.map((t) => ({
        ticketId: t.id,
        maskedCode: '…' + t.id.slice(-4).toUpperCase(),
        status: t.status,
        qrToken: t.qrToken,
      })),
      // Refund (Úloha 20) – customer smie požiadať len pre PAID bez otvorenej žiadosti.
      canRequestRefund:
        o.status === OrderStatus.PAID
        && !o.refundRequests.some((r) => r.status === 'REQUESTED'),
      refundRequests: o.refundRequests.map((r) => ({
        id: r.id,
        status: r.status,
        reason: r.reason,
        reviewNote: r.reviewNote,
        refundAmount: r.refundAmount != null ? Number(r.refundAmount) : null,
        requestedAt: r.requestedAt,
        reviewedAt: r.reviewedAt,
        refundedAt: r.refundedAt,
      })),
    };
  }

  /** PDF doklad pre vlastnú PAID objednávku. */
  async accountReceiptPdf(orderId: string, userId: string) {
    const o = await this.loadOwnOrder(orderId, userId);
    if (o.status !== OrderStatus.PAID) {
      throw codedBadRequest('RECEIPT_PAID_ONLY', 'Doklad je dostupný len pre zaplatené objednávky.');
    }
    const platform = await this.prisma.platformInfo.findFirst();
    const subtotal = Number(o.totalAmount) + Number(o.discountAmount);
    const customerFeeAmount = Number(o.feeAmount);

    const pdf = await generateReceiptPdf({
      orderNumber: o.orderNumber,
      createdAt: o.paidAt ?? o.createdAt,
      paymentLabel: o.paymentProvider ? PAYMENT_LABEL[o.paymentProvider] ?? o.paymentProvider : '—',
      buyerName: o.buyerName,
      buyerEmail: o.buyerEmail,
      currency: o.currency,
      items: o.items.map((i) => ({
        showTitle: i.termin?.show?.name ?? null,
        terminStartsAt: i.termin?.startsAt ?? null,
        ticketTypeName: i.ticketType?.name ?? null,
        quantity: i.quantity,
        unitPrice: Number(i.unitPrice),
        lineTotal: Number(i.unitPrice) * i.quantity,
      })),
      subtotal,
      discountAmount: Number(o.discountAmount),
      couponCode: o.coupon?.code ?? null,
      customerFeeAmount,
      // SPOLU = cena lístkov (po zľave) + zákaznícky poplatok = čo zákazník reálne zaplatil.
      total: Number(o.totalAmount) + customerFeeAmount,
      platform: {
        legalName: platform?.legalName ?? null,
        ico: platform?.ico ?? null,
        icDph: platform?.icDph ?? null,
        addressStreet: platform?.addressStreet ?? null,
        addressCity: platform?.addressCity ?? null,
        addressZip: platform?.addressZip ?? null,
      },
    });
    return { pdf, filename: `potvrdenie-${o.orderNumber}.pdf` };
  }
}
