import {
  Injectable, NotFoundException, ForbiddenException, ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from '../casl/casl-ability.factory';
import { UserRole, EventStatus, TerminStatus } from '@prisma/client';
import { CreateShowDto, UpdateShowDto } from './dto/show.dto';

@Injectable()
export class ShowsService {
  constructor(private prisma: PrismaService) {}

  private orgId(user: JwtPayload): string {
    if (!user.organizerId) throw new ForbiddenException();
    return user.organizerId;
  }

  private assertAccess(organizerId: string, user: JwtPayload) {
    if (user.role === UserRole.SUPERADMIN || user.role === UserRole.STAFF) return;
    if (user.organizerId !== organizerId) throw new ForbiddenException();
  }

  async findAll(user: JwtPayload) {
    const where =
      user.role === UserRole.SUPERADMIN || user.role === UserRole.STAFF
        ? {}
        : { organizerId: this.orgId(user) };
    const shows = await this.prisma.show.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { termins: true } },
        images: { where: { isCover: true }, take: 1 },
        termins: { select: { startsAt: true, endsAt: true } },
      },
    });
    // isPast = posledný termín skončil pred >5 h (endsAt, fallback startsAt) → v org zozname „Skončené".
    const cutoff = Date.now() - 5 * 60 * 60 * 1000;
    return shows.map((s) => {
      const ends = s.termins.map((t) => (t.endsAt ?? t.startsAt).getTime());
      const lastEnd = ends.length ? Math.max(...ends) : null;
      const { termins: _t, ...rest } = s;
      return { ...rest, isPast: lastEnd != null && lastEnd < cutoff };
    });
  }

  async findOne(id: string, user: JwtPayload) {
    const show = await this.prisma.show.findUnique({
      where: { id },
      include: {
        images: { orderBy: [{ isCover: 'desc' }, { sortOrder: 'asc' }] },
        termins: {
          orderBy: { startsAt: 'asc' },
          include: { venue: true, ticketTypes: { orderBy: { sortOrder: 'asc' } } },
        },
      },
    });
    if (!show) throw new NotFoundException();
    this.assertAccess(show.organizerId, user);
    return show;
  }

  async create(dto: CreateShowDto, user: JwtPayload) {
    const organizerId = this.orgId(user);
    const existing = await this.prisma.show.findUnique({
      where: { organizerId_slug: { organizerId, slug: dto.slug } },
    });
    if (existing) throw new ConflictException('Slug already in use');
    return this.prisma.show.create({ data: { ...dto as any, organizerId } });
  }

  async update(id: string, dto: UpdateShowDto, user: JwtPayload) {
    const show = await this.findOne(id, user);
    if (dto.slug && dto.slug !== show.slug) {
      const conflict = await this.prisma.show.findUnique({
        where: { organizerId_slug: { organizerId: show.organizerId, slug: dto.slug } },
      });
      if (conflict) throw new ConflictException('Slug already in use');
    }
    return this.prisma.show.update({ where: { id }, data: dto as any });
  }

  async updateStatus(id: string, status: EventStatus, user: JwtPayload) {
    const show = await this.prisma.show.findUnique({ where: { id } });
    if (!show) throw new NotFoundException();
    this.assertAccess(show.organizerId, user);
    return this.prisma.show.update({ where: { id }, data: { status } });
  }

  async remove(id: string, user: JwtPayload) {
    await this.findOne(id, user);
    return this.prisma.show.delete({ where: { id } });
  }

  /**
   * Kópia podujatia do nového draftu: názov, popis, kategória, SEO, šablóna lístka,
   * fotky, termíny (miesto) a ich typy lístkov. Kópia je vždy DRAFT a neverejná.
   * Pozn.: startsAt je NOT NULL, preto sa dátum kopíruje ako placeholder (organizer upraví).
   * Sedadlá (TerminSeat/TerminSection) a objednávky sa NEkopírujú.
   */
  async copyEvent(id: string, user: JwtPayload) {
    const source = await this.prisma.show.findUnique({
      where: { id },
      include: {
        images: { orderBy: [{ isCover: 'desc' }, { sortOrder: 'asc' }] },
        termins: { include: { ticketTypes: { orderBy: { sortOrder: 'asc' } } } },
      },
    });
    if (!source) throw new NotFoundException('Podujatie neexistuje.');
    this.assertAccess(source.organizerId, user);

    // Kópia patrí tej istej organizácii ako originál (aj keď kopíruje SUPERADMIN).
    const organizerId = source.organizerId;

    // Unikátny slug v rámci organizácie: "<slug>-kopia", "-kopia-2", ...
    const base = `${source.slug}-kopia`;
    let slug = base;
    for (let n = 2; ; n++) {
      const clash = await this.prisma.show.findUnique({
        where: { organizerId_slug: { organizerId, slug } },
      });
      if (!clash) break;
      slug = `${base}-${n}`;
    }

    return this.prisma.show.create({
      data: {
        organizerId,
        name: `${source.name} (kópia)`,
        slug,
        description: source.description,
        category: source.category,
        seoTitle: source.seoTitle,
        seoDescription: source.seoDescription,
        ticketTemplate: source.ticketTemplate ?? undefined,
        status: EventStatus.DRAFT, // kópia je vždy koncept
        isPromoted: false,         // nededí propagáciu na hero
        // sliderImageId zámerne vynechané – odkazuje na obrázok originálu
        images: {
          create: source.images.map((img) => ({
            url: img.url, thumbUrl: img.thumbUrl, squareUrl: img.squareUrl,
            isCover: img.isCover, sortOrder: img.sortOrder,
          })),
        },
        termins: {
          create: source.termins.map((t) => ({
            venueId: t.venueId,
            startsAt: t.startsAt, // placeholder (NOT NULL) – organizer upraví
            endsAt: t.endsAt,
            doorsOpenAt: t.doorsOpenAt,
            timezone: t.timezone,
            notes: t.notes,
            status: TerminStatus.DRAFT,
            visible: false, // neverejné kým organizer nespustí
            capacity: t.capacity,
            mode: t.mode,
            seatMapId: t.seatMapId, // zdieľaná definícia plániku; sedadlá sa nekopírujú
            ticketTypes: {
              create: t.ticketTypes.map((tt) => ({
                name: tt.name, description: tt.description, price: tt.price,
                currency: tt.currency, totalQuantity: tt.totalQuantity, maxPerOrder: tt.maxPerOrder,
                saleStartsAt: tt.saleStartsAt, saleEndsAt: tt.saleEndsAt,
                sortOrder: tt.sortOrder, isActive: tt.isActive, qrPaymentEnabled: tt.qrPaymentEnabled,
              })),
            },
          })),
        },
      },
      include: {
        images: true,
        termins: { include: { ticketTypes: true } },
      },
    });
  }
}
