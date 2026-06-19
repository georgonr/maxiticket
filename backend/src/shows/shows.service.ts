import {
  Injectable, NotFoundException, ForbiddenException, ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from '../casl/casl-ability.factory';
import { UserRole, EventStatus } from '@prisma/client';
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
}
