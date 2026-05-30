import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { ContactDto } from './contact.dto';
import { EventStatus, TerminStatus } from '@prisma/client';

const SALE_STATUSES: TerminStatus[] = [TerminStatus.ON_SALE, TerminStatus.COMING_SOON];

@Injectable()
export class PublicService {
  constructor(private prisma: PrismaService, private mail: MailService) {}

  async sendContactEmail(dto: ContactDto): Promise<{ ok: boolean }> {
    await this.mail.sendContactEmail(dto);
    return { ok: true };
  }

  async listShows(q: { category?: string; dateFilter?: string; city?: string }) {
    const now = new Date();
    const terminDateFilter = this.buildDateFilter(q.dateFilter, now);

    const terminWhere: any = {
      status: { in: SALE_STATUSES },
      visible: true,
      ...(terminDateFilter ? { startsAt: terminDateFilter } : {}),
      ...(q.city ? { venue: { city: { contains: q.city, mode: 'insensitive' } } } : {}),
    };

    const shows = await this.prisma.show.findMany({
      where: {
        status: EventStatus.PUBLISHED,
        ...(q.category ? { category: q.category } : {}),
        termins: { some: terminWhere },
      },
      include: {
        images: { where: { isCover: true }, take: 1 },
        termins: {
          where: terminWhere,
          orderBy: { startsAt: 'asc' },
          take: 3,
          include: {
            venue: { select: { name: true, city: true } },
            ticketTypes: {
              where: { isActive: true },
              orderBy: { price: 'asc' },
              take: 1,
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return shows.map((show) => {
      const firstTermin = show.termins[0];
      return {
        id: show.id,
        slug: show.slug,
        name: show.name,
        category: show.category ?? null,
        coverUrl: show.images[0]?.squareUrl ?? null,
        termins: show.termins.map((t) => ({
          id: t.id,
          startsAt: t.startsAt,
          timezone: t.timezone,
          status: t.status,
          city: (t.venue as any)?.city ?? null,
          venueName: (t.venue as any)?.name ?? null,
          minPrice: t.ticketTypes[0] ? Number(t.ticketTypes[0].price) : null,
          currency: t.ticketTypes[0]?.currency ?? 'EUR',
        })),
      };
    });
  }

  async getCategories(): Promise<string[]> {
    const rows = await this.prisma.show.findMany({
      where: { status: EventStatus.PUBLISHED, category: { not: null } },
      select: { category: true },
      distinct: ['category'],
    });
    return rows.map((r) => r.category!).filter(Boolean);
  }

  async getCities(): Promise<string[]> {
    const rows = await this.prisma.venue.findMany({
      where: {
        city: { not: null },
        termins: {
          some: {
            status: { in: SALE_STATUSES },
            visible: true,
            show: { status: EventStatus.PUBLISHED },
          },
        },
      },
      select: { city: true },
      distinct: ['city'],
    });
    return rows.map((r) => r.city!).filter(Boolean);
  }

  async getShowBySlug(slug: string) {
    const show = await this.prisma.show.findFirst({
      where: { slug, status: EventStatus.PUBLISHED },
      include: {
        images: { orderBy: [{ isCover: 'desc' }, { sortOrder: 'asc' }] },
        termins: {
          where: { status: { in: SALE_STATUSES }, visible: true },
          orderBy: { startsAt: 'asc' },
          include: {
            venue: true,
            ticketTypes: {
              where: { isActive: true },
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
      },
    });
    if (!show) throw new NotFoundException('Event not found');

    // Compute sold counts for availability display
    const terminIds = show.termins.map((t) => t.id);
    const sold = await this.prisma.orderItem.groupBy({
      by: ['ticketTypeId'],
      where: {
        terminId: { in: terminIds },
        order: { status: { in: ['PENDING', 'PAID'] } },
      },
      _sum: { quantity: true },
    });
    const soldMap = new Map(sold.map((s) => [s.ticketTypeId!, s._sum.quantity ?? 0]));

    return {
      ...show,
      termins: show.termins.map((t) => ({
        ...t,
        ticketTypes: t.ticketTypes.map((tt) => ({
          ...tt,
          price: Number(tt.price),
          available: tt.totalQuantity != null
            ? Math.max(0, tt.totalQuantity - (soldMap.get(tt.id) ?? 0))
            : null,
        })),
      })),
    };
  }

  private buildDateFilter(dateFilter: string | undefined, now: Date) {
    if (!dateFilter) return null;
    if (dateFilter === 'today') {
      const end = new Date(now);
      end.setHours(23, 59, 59, 999);
      return { gte: now, lte: end };
    }
    if (dateFilter === 'week') {
      const end = new Date(now);
      end.setDate(end.getDate() + 7);
      return { gte: now, lte: end };
    }
    if (dateFilter === 'weekend') {
      const day = now.getDay(); // 0=Sun, 6=Sat
      const toSat = day <= 6 ? (6 - day === 0 ? 0 : 6 - day) : 1;
      const sat = new Date(now);
      sat.setDate(now.getDate() + toSat);
      sat.setHours(0, 0, 0, 0);
      const sun = new Date(sat);
      sun.setDate(sat.getDate() + 1);
      sun.setHours(23, 59, 59, 999);
      return { gte: sat, lte: sun };
    }
    return null;
  }
}
