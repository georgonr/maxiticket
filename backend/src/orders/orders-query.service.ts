import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Prisma, OrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

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
    };
  }
}
