import {
  Injectable,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma, UserRole, OrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from '../casl/casl-ability.factory';

/**
 * Comp / manual orders sa NEZAPOČÍTAVAJÚ do revenue, ale ZAPOČÍTAVAJÚ do ticketsSold.
 * paymentProvider je voľný string (v DB napr. "stripe", "comp") – porovnávame
 * case-insensitive a NULL považujeme za reálnu platbu (počíta sa do revenue).
 */
const NON_COMP = Prisma.sql`(o."paymentProvider" IS NULL OR LOWER(o."paymentProvider") NOT IN ('comp', 'manual'))`;

const DAY_MS = 86_400_000;

@Injectable()
export class MetricsService {
  constructor(private readonly prisma: PrismaService) {}

  // ───────────────────────── helpers ─────────────────────────

  /** UTC hranice dňa. */
  private dayBoundaries() {
    const now = new Date();
    const startOfToday = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    const startOfYesterday = new Date(startOfToday.getTime() - DAY_MS);
    return { now, startOfToday, startOfYesterday };
  }

  /** Signed % zmena, zaokrúhlená na 1 desatinné miesto. */
  private pctChange(curr: number, prev: number): number {
    if (prev === 0) return curr > 0 ? 100 : 0;
    return Math.round(((curr - prev) / prev) * 1000) / 10;
  }

  private clamp(value: number, def: number, min: number, max: number): number {
    const n = Math.floor(value);
    if (!Number.isFinite(n) || n <= 0) return def;
    return Math.min(Math.max(n, min), max);
  }

  /**
   * Resolúcia organizerId pre organizer endpointy.
   * SUPERADMIN musí poslať ?organizerId=…; organizer roly scopujú na vlastný tenant.
   */
  private async resolveOrganizerId(
    user: JwtPayload,
    queryOrganizerId?: string,
  ): Promise<string> {
    if (user.role === UserRole.SUPERADMIN) {
      if (!queryOrganizerId) {
        throw new BadRequestException(
          'organizerId query param je povinný pre SUPERADMIN',
        );
      }
      return queryOrganizerId;
    }
    if (user.organizerId) return user.organizerId;
    // Fallback: token bez organizerId – dohľadaj z DB.
    const u = await this.prisma.user.findUnique({
      where: { id: user.sub },
      select: { organizerId: true },
    });
    if (!u?.organizerId) {
      throw new ForbiddenException('Užívateľ nemá priradeného organizátora');
    }
    return u.organizerId;
  }

  // ───────────────────────── ADMIN ─────────────────────────

  async adminOverview() {
    const { startOfToday, startOfYesterday } = this.dayBoundaries();

    const rev = await this.prisma.$queryRaw<{ today: unknown; yesterday: unknown }[]>(
      Prisma.sql`
        SELECT
          COALESCE(SUM(CASE WHEN o."createdAt" >= ${startOfToday} THEN o."totalAmount" ELSE 0 END), 0) AS today,
          COALESCE(SUM(CASE WHEN o."createdAt" >= ${startOfYesterday} AND o."createdAt" < ${startOfToday} THEN o."totalAmount" ELSE 0 END), 0) AS yesterday
        FROM "Order" o
        WHERE o.status = 'PAID' AND ${NON_COMP} AND o."createdAt" >= ${startOfYesterday}
      `,
    );
    const todayRevenue = Number(rev[0].today);
    const yesterdayRevenue = Number(rev[0].yesterday);

    const [
      ticketsSoldToday,
      ticketsSoldYesterday,
      activeShowsCount,
      organizersCount,
      pendingRefundsCount,
    ] = await Promise.all([
      // comp zahrnuté → iba status filter
      this.prisma.ticket.count({
        where: { order: { status: 'PAID', createdAt: { gte: startOfToday } } },
      }),
      this.prisma.ticket.count({
        where: {
          order: {
            status: 'PAID',
            createdAt: { gte: startOfYesterday, lt: startOfToday },
          },
        },
      }),
      this.prisma.show.count({ where: { status: 'PUBLISHED' } }),
      this.prisma.organizer.count(),
      // Úloha 20: otvorené žiadosti o vrátenie (Order.status = REFUND_REQUESTED).
      this.prisma.order.count({ where: { status: OrderStatus.REFUND_REQUESTED } }),
    ]);

    return {
      todayRevenue,
      ticketsSoldToday,
      activeShowsCount,
      organizersCount,
      pendingRefundsCount,
      todayRevenueChange: this.pctChange(todayRevenue, yesterdayRevenue),
      ticketsSoldChange: this.pctChange(ticketsSoldToday, ticketsSoldYesterday),
    };
  }

  adminSalesTrend(days: number) {
    return this.salesTrend(this.clamp(days, 7, 1, 90));
  }

  adminTopShows(limit: number) {
    return this.topShows(this.clamp(limit, 5, 1, 50));
  }

  adminRecentOrders(limit: number) {
    return this.recentOrders(this.clamp(limit, 5, 1, 50));
  }

  async adminOrganizers(limit: number, sort?: string) {
    const lim = this.clamp(limit, 20, 1, 100);

    const showCounts = await this.prisma.$queryRaw<
      {
        organizerId: string;
        name: string;
        slug: string;
        companyName: string | null;
        showsCount: unknown;
        publishedShowsCount: unknown;
      }[]
    >(Prisma.sql`
      SELECT org.id AS "organizerId", org.name, org.slug, org."companyName",
             COUNT(s.id) AS "showsCount",
             COUNT(s.id) FILTER (WHERE s.status = 'PUBLISHED') AS "publishedShowsCount"
      FROM "Organizer" org
      LEFT JOIN "Show" s ON s."organizerId" = org.id
      GROUP BY org.id, org.name, org.slug, org."companyName"
    `);

    // revenue je order-level (Order má organizerId priamo) → žiadny fan-out cez tickety
    const revRows = await this.prisma.$queryRaw<
      { organizerId: string; totalRevenue: unknown }[]
    >(Prisma.sql`
      SELECT o."organizerId", COALESCE(SUM(o."totalAmount"), 0) AS "totalRevenue"
      FROM "Order" o
      WHERE o.status = 'PAID' AND ${NON_COMP}
      GROUP BY o."organizerId"
    `);

    // tickety vrátane comp (iba status filter), samostatný query kvôli fan-outu
    const tkRows = await this.prisma.$queryRaw<
      { organizerId: string; totalTicketsSold: unknown }[]
    >(Prisma.sql`
      SELECT o."organizerId", COUNT(t.id) AS "totalTicketsSold"
      FROM "Order" o JOIN "Ticket" t ON t."orderId" = o.id
      WHERE o.status = 'PAID'
      GROUP BY o."organizerId"
    `);

    const revMap = new Map(revRows.map((r) => [r.organizerId, Number(r.totalRevenue)]));
    const tkMap = new Map(tkRows.map((r) => [r.organizerId, Number(r.totalTicketsSold)]));

    const list = showCounts.map((r) => {
      const totalRevenue = revMap.get(r.organizerId) ?? 0;
      return {
        organizerId: r.organizerId,
        name: r.name,
        slug: r.slug,
        companyName: r.companyName,
        showsCount: Number(r.showsCount),
        publishedShowsCount: Number(r.publishedShowsCount),
        totalRevenue,
        totalTicketsSold: tkMap.get(r.organizerId) ?? 0,
        // TODO: Replace with real commission/payout calc in Úloha 13
        outstandingPayout: Math.round(totalRevenue * 0.92 * 100) / 100,
      };
    });

    const sortKey =
      sort === 'ticketsSold' ? 'ticketsSold' : sort === 'name' ? 'name' : 'revenue';
    list.sort((a, b) => {
      if (sortKey === 'name') return a.name.localeCompare(b.name);
      if (sortKey === 'ticketsSold') return b.totalTicketsSold - a.totalTicketsSold;
      return b.totalRevenue - a.totalRevenue;
    });

    return list.slice(0, lim);
  }

  // ─────────────────────── ORGANIZER ───────────────────────

  async organizerOverview(user: JwtPayload, queryOrganizerId?: string) {
    const organizerId = await this.resolveOrganizerId(user, queryOrganizerId);
    const { now, startOfToday } = this.dayBoundaries();

    const [
      myShowsCount,
      myPublishedShowsCount,
      myTicketsSoldToday,
      myTotalTicketsSold,
      myUpcomingTermins,
      capAgg,
      myCapacityFilled,
    ] = await Promise.all([
      this.prisma.show.count({ where: { organizerId } }),
      this.prisma.show.count({ where: { organizerId, status: 'PUBLISHED' } }),
      this.prisma.ticket.count({
        where: {
          order: { organizerId, status: 'PAID', createdAt: { gte: startOfToday } },
        },
      }),
      this.prisma.ticket.count({
        where: { order: { organizerId, status: 'PAID' } },
      }),
      this.prisma.termin.count({
        where: { show: { organizerId }, startsAt: { gte: now } },
      }),
      this.prisma.termin.aggregate({
        _sum: { capacity: true },
        where: { show: { organizerId }, startsAt: { gte: now } },
      }),
      this.prisma.ticket.count({
        where: {
          status: { in: ['VALID', 'USED'] },
          termin: { startsAt: { gte: now }, show: { organizerId } },
        },
      }),
    ]);

    const rev = await this.prisma.$queryRaw<{ today: unknown; total: unknown }[]>(
      Prisma.sql`
        SELECT
          COALESCE(SUM(CASE WHEN o."createdAt" >= ${startOfToday} THEN o."totalAmount" ELSE 0 END), 0) AS today,
          COALESCE(SUM(o."totalAmount"), 0) AS total
        FROM "Order" o
        WHERE o.status = 'PAID' AND ${NON_COMP} AND o."organizerId" = ${organizerId}
      `,
    );

    return {
      myShowsCount,
      myPublishedShowsCount,
      myTodayRevenue: Number(rev[0].today),
      myTotalRevenue: Number(rev[0].total),
      myTicketsSoldToday,
      myTotalTicketsSold,
      myUpcomingTermins,
      myCapacityTotal: capAgg._sum.capacity ?? 0,
      myCapacityFilled,
    };
  }

  async organizerSalesTrend(user: JwtPayload, days: number, queryOrganizerId?: string) {
    const organizerId = await this.resolveOrganizerId(user, queryOrganizerId);
    return this.salesTrend(this.clamp(days, 7, 1, 90), organizerId);
  }

  async organizerTopShows(user: JwtPayload, limit: number, queryOrganizerId?: string) {
    const organizerId = await this.resolveOrganizerId(user, queryOrganizerId);
    return this.topShows(this.clamp(limit, 5, 1, 50), organizerId);
  }

  async organizerRecentOrders(user: JwtPayload, limit: number, queryOrganizerId?: string) {
    const organizerId = await this.resolveOrganizerId(user, queryOrganizerId);
    return this.recentOrders(this.clamp(limit, 10, 1, 50), organizerId);
  }

  // ─────────────────── zdieľané agregácie ───────────────────

  private async salesTrend(days: number, organizerId?: string) {
    const { startOfToday } = this.dayBoundaries();
    const start = new Date(startOfToday.getTime() - (days - 1) * DAY_MS);
    const orgFilter = organizerId
      ? Prisma.sql`AND o."organizerId" = ${organizerId}`
      : Prisma.empty;

    const revRows = await this.prisma.$queryRaw<{ date: string; revenue: unknown }[]>(
      Prisma.sql`
        SELECT to_char(date_trunc('day', o."createdAt"), 'YYYY-MM-DD') AS date,
               COALESCE(SUM(o."totalAmount"), 0) AS revenue
        FROM "Order" o
        WHERE o.status = 'PAID' AND ${NON_COMP} AND o."createdAt" >= ${start} ${orgFilter}
        GROUP BY 1
      `,
    );

    const tkRows = await this.prisma.$queryRaw<{ date: string; tickets: unknown }[]>(
      Prisma.sql`
        SELECT to_char(date_trunc('day', o."createdAt"), 'YYYY-MM-DD') AS date,
               COUNT(t.id) AS tickets
        FROM "Ticket" t JOIN "Order" o ON o.id = t."orderId"
        WHERE o.status = 'PAID' AND o."createdAt" >= ${start} ${orgFilter}
        GROUP BY 1
      `,
    );

    const revMap = new Map(revRows.map((r) => [r.date, Number(r.revenue)]));
    const tkMap = new Map(tkRows.map((r) => [r.date, Number(r.tickets)]));

    const out: { date: string; revenue: number; ticketsSold: number }[] = [];
    for (let i = 0; i < days; i++) {
      const key = new Date(start.getTime() + i * DAY_MS).toISOString().slice(0, 10);
      out.push({
        date: key,
        revenue: revMap.get(key) ?? 0,
        ticketsSold: tkMap.get(key) ?? 0,
      });
    }
    return out;
  }

  private async topShows(limit: number, organizerId?: string) {
    const orgFilter = organizerId
      ? Prisma.sql`AND s."organizerId" = ${organizerId}`
      : Prisma.empty;

    // revenue per show je ticket-level (tt.price), lebo Order je org-level a môže
    // zahŕňať viac shows; comp vylúčené z revenue, započítané do ticketsSold.
    const rows = await this.prisma.$queryRaw<
      {
        showId: string;
        slug: string;
        title: string;
        organizerName: string;
        ticketsSold: unknown;
        revenue: unknown;
      }[]
    >(Prisma.sql`
      SELECT s.id AS "showId", s.slug AS slug, s.name AS title, org.name AS "organizerName",
             COUNT(t.id) AS "ticketsSold",
             COALESCE(SUM(CASE WHEN ${NON_COMP} THEN tt.price ELSE 0 END), 0) AS revenue
      FROM "Show" s
      JOIN "Organizer" org ON org.id = s."organizerId"
      JOIN "Termin" te ON te."showId" = s.id
      JOIN "Ticket" t ON t."terminId" = te.id
      JOIN "Order" o ON o.id = t."orderId" AND o.status = 'PAID'
      JOIN "TicketType" tt ON tt.id = t."ticketTypeId"
      WHERE s.status = 'PUBLISHED' ${orgFilter}
      GROUP BY s.id, s.slug, s.name, org.name
      ORDER BY "ticketsSold" DESC
      LIMIT ${limit}
    `);

    return rows.map((r) => ({
      showId: r.showId,
      slug: r.slug,
      title: r.title,
      revenue: Number(r.revenue),
      ticketsSold: Number(r.ticketsSold),
      organizerName: r.organizerName,
    }));
  }

  private async recentOrders(limit: number, organizerId?: string) {
    const orders = await this.prisma.order.findMany({
      where: organizerId ? { organizerId } : undefined,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        totalAmount: true,
        buyerName: true,
        buyerEmail: true,
        createdAt: true,
        _count: { select: { tickets: true } },
        items: {
          select: { termin: { select: { show: { select: { name: true } } } } },
        },
      },
    });

    return orders.map((o) => ({
      orderId: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      totalAmount: Number(o.totalAmount),
      buyerName: o.buyerName,
      buyerEmail: o.buyerEmail,
      showTitle: o.items.map((i) => i.termin?.show?.name).find(Boolean) ?? null,
      ticketCount: o._count.tickets,
      createdAt: o.createdAt,
    }));
  }
}
