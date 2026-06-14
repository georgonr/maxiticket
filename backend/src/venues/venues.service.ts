import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from '../casl/casl-ability.factory';
import { CreateVenueDto, UpdateVenueDto } from './dto/venue.dto';

export interface VenueListQuery {
  search?: string;
  isActive?: string; // 'true' → len aktívne (napr. pre dropdown)
  organizerId?: string; // len super/staff
}

export interface CreateVenueOptions {
  global?: boolean; // super/staff → vytvorí globálne (organizerId=null)
  organizerId?: string; // super/staff → cieľový organizer
}

@Injectable()
export class VenuesService {
  constructor(private prisma: PrismaService) {}

  private isSuperOrStaff(user: JwtPayload): boolean {
    return user.role === UserRole.SUPERADMIN || user.role === UserRole.STAFF;
  }

  private orgId(user: JwtPayload): string {
    if (!user.organizerId) throw new ForbiddenException();
    return user.organizerId;
  }

  /** Mutácie (create/update/delete) smie len OWNER alebo super/staff – nie MEMBER. */
  private assertCanMutate(user: JwtPayload) {
    if (this.isSuperOrStaff(user) || user.role === UserRole.ORGANIZER_OWNER) return;
    throw new ForbiddenException('Na správu miest nemáte oprávnenie.');
  }

  findAll(user: JwtPayload, query: VenueListQuery = {}) {
    const where: Prisma.VenueWhereInput = {};

    if (this.isSuperOrStaff(user)) {
      if (query.organizerId) where.organizerId = query.organizerId;
    } else {
      // Úloha 24: organizer vidí vlastné + sprístupnené (VenueAccess). Globálne (organizerId=null)
      // už NIE sú auto-viditeľné – iba ak ich SUPERADMIN sprístupní.
      const mine = this.orgId(user);
      where.OR = [{ organizerId: mine }, { accesses: { some: { organizerId: mine } } }];
    }

    if (query.isActive === 'true') where.isActive = true;

    if (query.search) {
      const s = query.search.trim();
      if (s) {
        const term = { contains: s, mode: 'insensitive' as const };
        const searchOr: Prisma.VenueWhereInput[] = [{ name: term }, { city: term }];
        // Skombinuj s prípadným ownership OR cez AND, aby sa nevyrušili.
        if (where.OR) {
          where.AND = [{ OR: where.OR }, { OR: searchOr }];
          delete where.OR;
        } else {
          where.OR = searchOr;
        }
      }
    }

    return this.prisma.venue.findMany({ where, orderBy: { name: 'asc' } });
  }

  async findOne(id: string, user: JwtPayload) {
    const v = await this.prisma.venue.findUnique({ where: { id } });
    if (!v) throw new NotFoundException('Miesto neexistuje.');
    await this.assertReadAccess(v, user);
    return v;
  }

  async create(dto: CreateVenueDto, user: JwtPayload, opts: CreateVenueOptions = {}) {
    this.assertCanMutate(user);

    let organizerId: string | null;
    if (this.isSuperOrStaff(user)) {
      if (opts.global) {
        organizerId = null;
      } else if (opts.organizerId) {
        organizerId = opts.organizerId;
      } else {
        throw new BadRequestException(
          'SUPERADMIN musí zadať ?global=true alebo ?organizerId.',
        );
      }
    } else {
      organizerId = this.orgId(user);
    }

    return this.prisma.venue.create({ data: { ...dto, organizerId } });
  }

  async update(id: string, dto: UpdateVenueDto, user: JwtPayload) {
    this.assertCanMutate(user);
    const venue = await this.prisma.venue.findUnique({ where: { id } });
    if (!venue) throw new NotFoundException('Miesto neexistuje.');
    this.assertManageAccess(venue.organizerId, user);
    return this.prisma.venue.update({ where: { id }, data: dto });
  }

  async remove(id: string, user: JwtPayload) {
    this.assertCanMutate(user);
    const venue = await this.prisma.venue.findUnique({
      where: { id },
      include: { _count: { select: { termins: true } } },
    });
    if (!venue) throw new NotFoundException('Miesto neexistuje.');
    this.assertManageAccess(venue.organizerId, user);

    if (venue._count.termins > 0) {
      // Soft delete – miesto je naviazané na existujúce termíny (zachová ich dáta).
      const updated = await this.prisma.venue.update({
        where: { id },
        data: { isActive: false },
      });
      return { deleted: false, deactivated: true, venue: updated };
    }

    await this.prisma.venue.delete({ where: { id } });
    return { deleted: true, deactivated: false };
  }

  /** Pre validáciu venueId pri create/update termínu: vlastné alebo sprístupnené (super = hocijaké). */
  async assertUsableForTermin(venueId: string, user: JwtPayload) {
    const venue = await this.prisma.venue.findUnique({ where: { id: venueId } });
    if (!venue) throw new BadRequestException('Zvolené miesto neexistuje.');
    if (this.isSuperOrStaff(user)) return venue;
    if (user.organizerId && venue.organizerId === user.organizerId) return venue; // vlastné
    if (user.organizerId && (await this.hasVenueAccess(venueId, user.organizerId))) return venue; // sprístupnené
    throw new ForbiddenException('Zvolené miesto nie je dostupné vašej organizácii.');
  }

  /**
   * Načíta venue podľa id a overí ČÍTACÍ prístup (vlastné + sprístupnené + super/staff).
   * Reuse seat-mapami (úloha 22): prístup k mape sa rozhoduje cez jej venue.
   */
  async getVenueForRead(venueId: string, user: JwtPayload) {
    const venue = await this.prisma.venue.findUnique({ where: { id: venueId } });
    if (!venue) throw new NotFoundException('Miesto neexistuje.');
    await this.assertReadAccess(venue, user);
    return venue;
  }

  /**
   * Načíta venue podľa id a overí MANAŽÉRSKY prístup (super/staff všetko; organizer
   * len vlastné; globálne → 403). Reuse seat-mapami (úloha 22) pri mutáciách.
   */
  async getVenueForManage(venueId: string, user: JwtPayload) {
    const venue = await this.prisma.venue.findUnique({ where: { id: venueId } });
    if (!venue) throw new NotFoundException('Miesto neexistuje.');
    this.assertManageAccess(venue.organizerId, user);
    return venue;
  }

  /** Existuje VenueAccess pre dvojicu (venue, organizer)? */
  private async hasVenueAccess(venueId: string, organizerId: string): Promise<boolean> {
    const access = await this.prisma.venueAccess.findUnique({
      where: { venueId_organizerId: { venueId, organizerId } },
    });
    return access !== null;
  }

  /**
   * Úloha 24: Čítanie – super/staff všetko; organizer len vlastné ALEBO sprístupnené (VenueAccess).
   * Globálne (organizerId=null) už NIE sú auto-čitateľné. ASYNC – volajúci MUSÍ awaitovať.
   */
  private async assertReadAccess(
    venue: { id: string; organizerId: string | null },
    user: JwtPayload,
  ) {
    if (this.isSuperOrStaff(user)) return;
    if (user.organizerId && venue.organizerId === user.organizerId) return; // vlastné
    if (user.organizerId && (await this.hasVenueAccess(venue.id, user.organizerId))) return; // sprístupnené
    throw new ForbiddenException();
  }

  /** Správa: super/staff všetko; organizer len vlastné (globálne aj sprístupnené → 403, read-only). */
  private assertManageAccess(organizerId: string | null, user: JwtPayload) {
    if (this.isSuperOrStaff(user)) return;
    if (organizerId === null) {
      throw new ForbiddenException('Globálne miesto môže upravovať len administrátor.');
    }
    if (user.organizerId !== organizerId) throw new ForbiddenException();
  }

  // ── Úloha 24: zdieľanie miesta (SUPERADMIN/STAFF) ────────────────────────────

  /** Zoznam organizerId, ktorým je miesto sprístupnené. */
  async getAccess(venueId: string, user: JwtPayload) {
    if (!this.isSuperOrStaff(user)) throw new ForbiddenException();
    const venue = await this.prisma.venue.findUnique({ where: { id: venueId } });
    if (!venue) throw new NotFoundException('Miesto neexistuje.');
    const rows = await this.prisma.venueAccess.findMany({
      where: { venueId },
      select: { organizerId: true },
    });
    return { venueId, organizerIds: rows.map((r) => r.organizerId) };
  }

  /** Nastav množinu organizátorov so sprístupnením (diff: pridaj chýbajúce, odober zvyšok). */
  async setAccess(venueId: string, organizerIds: string[], user: JwtPayload) {
    if (!this.isSuperOrStaff(user)) throw new ForbiddenException();
    const venue = await this.prisma.venue.findUnique({ where: { id: venueId } });
    if (!venue) throw new NotFoundException('Miesto neexistuje.');

    const desired = [...new Set(organizerIds ?? [])];
    if (desired.length) {
      const count = await this.prisma.organizer.count({ where: { id: { in: desired } } });
      if (count !== desired.length) throw new BadRequestException('Niektorý organizátor neexistuje.');
    }

    await this.prisma.$transaction([
      this.prisma.venueAccess.deleteMany({
        where: { venueId, ...(desired.length ? { organizerId: { notIn: desired } } : {}) },
      }),
      ...(desired.length
        ? [this.prisma.venueAccess.createMany({
            data: desired.map((organizerId) => ({ venueId, organizerId })),
            skipDuplicates: true,
          })]
        : []),
    ]);

    return this.getAccess(venueId, user);
  }
}
