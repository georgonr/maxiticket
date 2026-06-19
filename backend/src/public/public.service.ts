import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { codedNotFound } from '../common/errors/coded-exception';
import { ContactDto } from './contact.dto';
import { EventStatus, TerminStatus, SectionMode } from '@prisma/client';

const SALE_STATUSES: TerminStatus[] = [TerminStatus.ON_SALE, TerminStatus.COMING_SOON];

// Verejný ZOZNAM skrýva termíny skončené pred VIAC ako 5 h (endsAt + 5h; fallback startsAt).
// Detail (getShowBySlug) tento filter NEpoužíva – ostáva dostupný cez link/lístok.
const PAST_GRACE_MS = 5 * 60 * 60 * 1000;
function notEndedOr() {
  const cutoff = new Date(Date.now() - PAST_GRACE_MS);
  return [
    { endsAt: { gte: cutoff } },
    { endsAt: null, startsAt: { gte: cutoff } },
  ];
}
const HERO_CAP = 8;
const HERO_CACHE_TTL_MS = 60_000;

@Injectable()
export class PublicService {
  private heroCache: { data: unknown; expiresAt: number } | null = null;

  constructor(private prisma: PrismaService, private mail: MailService) {}

  async getHeroSlides(): Promise<unknown[]> {
    const now = Date.now();
    if (this.heroCache && this.heroCache.expiresAt > now) {
      return this.heroCache.data as unknown[];
    }

    const nowDate = new Date();

    // Fetch active banners
    const banners = await this.prisma.heroBanner.findMany({
      where: {
        isActive: true,
        OR: [{ activeFrom: null }, { activeFrom: { lte: nowDate } }],
        AND: [{ OR: [{ activeUntil: null }, { activeUntil: { gte: nowDate } }] }],
      },
      orderBy: { sortOrder: 'asc' },
    });

    // Fetch promoted shows with nearest active termin
    const heroTerminWhere = { status: { in: SALE_STATUSES }, visible: true, OR: notEndedOr() };
    const promotedShows = await this.prisma.show.findMany({
      where: {
        isPromoted: true,
        status: EventStatus.PUBLISHED,
        termins: { some: heroTerminWhere },
      },
      include: {
        sliderImage: { select: { squareUrl: true } },
        images: { where: { isCover: true }, take: 1 },
        termins: {
          where: heroTerminWhere,
          orderBy: { startsAt: 'asc' },
          take: 1,
          include: { venue: { select: { name: true, city: true } } },
        },
      },
    });

    const bannerSlides = banners.map((b) => ({
      type: 'banner' as const,
      id: b.id,
      title: b.title,
      subtitle: b.subtitle ?? null,
      imageUrl: b.imageUrl,
      ctaLabel: b.ctaLabel ?? null,
      ctaUrl: b.ctaUrl ?? null,
      sortOrder: b.sortOrder,
    }));

    const showSlides = promotedShows
      .filter((s) => s.termins.length > 0)
      .sort((a, b) => a.termins[0].startsAt.getTime() - b.termins[0].startsAt.getTime())
      .map((s) => {
        const t = s.termins[0];
        return {
          type: 'show' as const,
          id: s.id,
          slug: s.slug,
          name: s.name,
          imageUrl: (s.sliderImage as any)?.squareUrl ?? (s.images[0] as any)?.squareUrl ?? null,
          startsAt: t.startsAt,
          timezone: t.timezone,
          city: (t.venue as any)?.city ?? null,
          venueName: (t.venue as any)?.name ?? null,
          ctaUrl: `/events/${s.slug}`,
        };
      });

    const slides = [...bannerSlides, ...showSlides].slice(0, HERO_CAP);

    this.heroCache = { data: slides, expiresAt: now + HERO_CACHE_TTL_MS };
    return slides;
  }

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
      OR: notEndedOr(),
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

  /**
   * Krok 30: pool vybraných verejných podujatí pre homepage (až 36), mix
   * NAJNAVŠTEVOVANEJŠIE (počet predaných lístkov, reálna metrika) + NAJNOVŠIE (recency tiebreak)
   * + promované navrch. Rovnaký tvar ako listShows → frontend reuse karty.
   */
  async featuredShows() {
    const terminWhere = { status: { in: SALE_STATUSES }, visible: true, OR: notEndedOr() };
    const candidates = await this.prisma.show.findMany({
      where: { status: EventStatus.PUBLISHED, termins: { some: terminWhere } },
      include: {
        images: { where: { isCover: true }, take: 1 },
        termins: {
          where: terminWhere,
          orderBy: { startsAt: 'asc' },
          take: 1,
          include: {
            venue: { select: { name: true, city: true } },
            ticketTypes: { where: { isActive: true }, orderBy: { price: 'asc' }, take: 1 },
          },
        },
      },
      orderBy: { createdAt: 'desc' }, // recency baseline
      take: 80,
    });
    if (candidates.length === 0) return [];

    const showIds = candidates.map((s) => s.id);
    // predané lístky per show (cez terminId → showId)
    const termins = await this.prisma.termin.findMany({
      where: { showId: { in: showIds } },
      select: { id: true, showId: true },
    });
    const terminToShow = new Map(termins.map((t) => [t.id, t.showId]));
    const sold = await this.prisma.orderItem.groupBy({
      by: ['terminId'],
      where: { termin: { showId: { in: showIds } }, order: { status: 'PAID' } },
      _sum: { quantity: true },
    });
    const soldByShow = new Map<string, number>();
    for (const r of sold) {
      const sid = r.terminId ? terminToShow.get(r.terminId) : undefined;
      if (sid) soldByShow.set(sid, (soldByShow.get(sid) ?? 0) + (r._sum.quantity ?? 0));
    }

    const ranked = [...candidates].sort((a, b) => {
      if (a.isPromoted !== b.isPromoted) return a.isPromoted ? -1 : 1;
      const sa = soldByShow.get(a.id) ?? 0;
      const sb = soldByShow.get(b.id) ?? 0;
      if (sb !== sa) return sb - sa; // najnavštevovanejšie
      return b.createdAt.getTime() - a.createdAt.getTime(); // najnovšie tiebreak
    }).slice(0, 36);

    return ranked.map((show) => ({
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
    }));
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
            OR: notEndedOr(),
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
            terminSections: {
              include: { section: true },
              orderBy: { section: { displayOrder: 'asc' } },
            },
          },
        },
      },
    });
    if (!show) throw codedNotFound('EVENT_NOT_FOUND', 'Event not found');

    // Compute sold counts for availability display (GENERAL: per ticketType)
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

    // Úloha 22/3a: predané kusy per TerminSection (SEATMAP/SECTIONED dostupnosť)
    const sectionIds = show.termins.flatMap((t) => t.terminSections.map((ts) => ts.id));
    const sectionSold = sectionIds.length
      ? await this.prisma.orderItem.groupBy({
          by: ['terminSectionId'],
          where: {
            terminSectionId: { in: sectionIds },
            order: { status: { in: ['PENDING', 'PAID'] } },
          },
          _sum: { quantity: true },
        })
      : [];
    const sectionSoldMap = new Map(sectionSold.map((s) => [s.terminSectionId!, s._sum.quantity ?? 0]));

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
        // SEATMAP režim: sekcie s cenou. SECTIONED = množstvo (available z kapacity),
        // SEATED = výber sedadiel (dostupnosť rieši seat-picker cez /termins/:id/seats).
        sections: t.terminSections.map((ts) => {
          const soldQty = sectionSoldMap.get(ts.id) ?? 0;
          const isSectioned = ts.section.mode === 'SECTIONED';
          return {
            id: ts.id,
            name: ts.section.name,
            sectionMode: ts.section.mode,
            price: Number(ts.price),
            currency: ts.currency,
            available: isSectioned && ts.section.capacity != null
              ? Math.max(0, ts.section.capacity - soldQty)
              : null,
            sellable: true, // SECTIONED aj SEATED sú v 3b predajné
          };
        }),
      })),
    };
  }

  /**
   * Úloha 22/3b: sedadlá SEATED sekcií termínu so statusom (available/taken) – pre verejný picker.
   * NEleakuje kto sedadlo drží (len taken/available). Cena = TerminSection.price danej sekcie.
   */
  async getTerminSeats(terminId: string) {
    const termin = await this.prisma.termin.findFirst({
      where: { id: terminId, status: { in: SALE_STATUSES }, visible: true },
      include: {
        terminSections: {
          where: { section: { mode: SectionMode.SEATED } },
          orderBy: { section: { displayOrder: 'asc' } },
          include: {
            section: {
              include: {
                rows: {
                  orderBy: { displayOrder: 'asc' },
                  include: { seats: { orderBy: { label: 'asc' } } },
                },
              },
            },
          },
        },
      },
    });
    if (!termin) throw codedNotFound('TERMIN_NOT_AVAILABLE', 'Termín nie je dostupný.');

    const seatStatuses = await this.prisma.terminSeat.findMany({
      where: { terminId },
      select: { seatId: true, status: true },
    });
    const statusMap = new Map(seatStatuses.map((s) => [s.seatId, s.status]));

    return {
      terminId,
      sections: termin.terminSections.map((ts) => ({
        id: ts.id, // terminSectionId – posiela sa späť pri objednávke
        sectionId: ts.sectionId,
        name: ts.section.name,
        color: ts.section.color,
        price: Number(ts.price),
        currency: ts.currency,
        rows: ts.section.rows.map((r) => ({
          id: r.id,
          label: r.label,
          seats: r.seats.map((seat) => ({
            id: seat.id,
            label: seat.label,
            isAccessible: seat.isAccessible,
            taken: (statusMap.get(seat.id) ?? 'AVAILABLE') !== 'AVAILABLE',
          })),
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

  /**
   * Krok 2/2: vypočíta zákaznícky poplatok za spracovanie pre danú sumu (display
   * v checkoute). Vracia LEN sumu poplatku – %-konfig organizátora sa von neposiela.
   * Autoritatívny poplatok sa prepočíta server-side až pri initiateCheckout.
   */
  async checkoutFeeQuote(terminId: string, amount: number) {
    const safeAmount = Number.isFinite(amount) && amount > 0 ? amount : 0;
    const termin = await this.prisma.termin.findUnique({
      where: { id: terminId },
      select: { show: { select: { organizer: { select: { customerFeePercent: true } } } } },
    });
    const pct = Number(termin?.show?.organizer?.customerFeePercent ?? 0);
    const feeAmount = safeAmount > 0 ? Math.round(safeAmount * pct) / 100 : 0;
    return { feeAmount };
  }

  /**
   * QR rýchly nákup – verejné info o type lístka pre stránku /q/[ticketTypeId].
   * LEN GENERAL (voľné sedenie). Vracia purchasable + reason aj keď sa nedá kúpiť (UI zobrazí hlášku).
   */
  async qrTicketInfo(ticketTypeId: string) {
    const tt = await this.prisma.ticketType.findUnique({
      where: { id: ticketTypeId },
      include: {
        termin: {
          include: {
            venue: true,
            show: { include: { images: { orderBy: [{ isCover: 'desc' }, { sortOrder: 'asc' }] }, organizer: { select: { name: true } } } },
          },
        },
      },
    });
    if (!tt) throw codedNotFound('TICKET_TYPE_NOT_FOUND', 'Typ lístka neexistuje.');

    const termin = tt.termin;
    const show = termin.show;
    const now = new Date();

    // dostupnosť (PENDING+PAID rezervujú)
    const sold = await this.prisma.orderItem.aggregate({
      where: { ticketTypeId: tt.id, order: { status: { in: ['PENDING', 'PAID'] } } },
      _sum: { quantity: true },
    });
    const available = tt.totalQuantity != null ? Math.max(0, tt.totalQuantity - (sold._sum.quantity ?? 0)) : null;

    // purchasable + dôvod
    let reason: 'OK' | 'NOT_GA' | 'QR_DISABLED' | 'INACTIVE' | 'NOT_ON_SALE' | 'PAST' | 'SOLD_OUT' | 'SALE_WINDOW' = 'OK';
    if (termin.mode !== 'GENERAL') reason = 'NOT_GA';
    else if (!tt.qrPaymentEnabled) reason = 'QR_DISABLED'; // master prepínač vypnutý
    else if (show.status !== EventStatus.PUBLISHED || !tt.isActive) reason = 'INACTIVE';
    else if (termin.status !== TerminStatus.ON_SALE) reason = 'NOT_ON_SALE';
    else if (termin.startsAt < now) reason = 'PAST';
    else if (tt.saleStartsAt && now < tt.saleStartsAt) reason = 'SALE_WINDOW';
    else if (tt.saleEndsAt && now > tt.saleEndsAt) reason = 'SALE_WINDOW';
    else if (available != null && available <= 0) reason = 'SOLD_OUT';

    const cap = Math.min(10, tt.maxPerOrder, available ?? 10);
    const maxQuantity = Math.max(0, cap);

    return {
      ticketTypeId: tt.id,
      name: tt.name,
      description: tt.description,
      price: Number(tt.price),
      currency: tt.currency,
      qrPaymentEnabled: tt.qrPaymentEnabled,
      available,
      maxQuantity,
      purchasable: reason === 'OK' && maxQuantity > 0,
      reason: reason === 'OK' && maxQuantity <= 0 ? 'SOLD_OUT' : reason,
      show: {
        name: show.name,
        slug: show.slug,
        imageUrl: (show.images[0] as any)?.squareUrl ?? null,
        organizerName: show.organizer?.name ?? null,
      },
      termin: {
        startsAt: termin.startsAt,
        endsAt: termin.endsAt,
        venueName: termin.venue?.name ?? null,
        venueCity: termin.venue?.city ?? null,
      },
    };
  }
}
