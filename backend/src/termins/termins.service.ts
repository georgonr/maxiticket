import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from '../casl/casl-ability.factory';
import { UserRole, TerminMode, OrderStatus, SectionMode, SeatStatus } from '@prisma/client';
import { CreateTerminDto, UpdateTerminDto, UpdateTerminSectionDto } from './dto/termin.dto';
import { VenuesService } from '../venues/venues.service';

@Injectable()
export class TerminsService {
  constructor(
    private prisma: PrismaService,
    private venues: VenuesService,
  ) {}

  private async assertShowAccess(showId: string, user: JwtPayload) {
    const show = await this.prisma.show.findUnique({ where: { id: showId } });
    if (!show) throw new NotFoundException('Show not found');
    if (user.role !== UserRole.SUPERADMIN && user.role !== UserRole.STAFF) {
      if (show.organizerId !== user.organizerId) throw new ForbiddenException();
    }
    return show;
  }

  async findAll(showId: string, user: JwtPayload) {
    // Tenant scoping (krok 52): organizer vidí termíny LEN svojho podujatia. Predtým sa
    // `user` ignoroval → ktokoľvek prihlásený videl termíny cudzieho show (cross-tenant read).
    // Vzor rovnaký ako findOne. Verejný predaj používa /v1/public/* (nie tento auth endpoint).
    await this.assertShowAccess(showId, user);
    return this.prisma.termin.findMany({
      where: { showId },
      include: { venue: true, ticketTypes: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { startsAt: 'asc' },
    });
  }

  async findOne(showId: string, id: string, user: JwtPayload) {
    await this.assertShowAccess(showId, user);
    const termin = await this.prisma.termin.findUnique({
      where: { id },
      include: { venue: true, ticketTypes: true },
    });
    if (!termin || termin.showId !== showId) throw new NotFoundException();
    return termin;
  }

  async create(showId: string, dto: CreateTerminDto, user: JwtPayload) {
    await this.assertShowAccess(showId, user);
    await this.venues.assertUsableForTermin(dto.venueId, user);
    const { venueId, startsAt, endsAt, doorsOpenAt, ...rest } = dto;
    return this.prisma.termin.create({
      data: {
        showId,
        venueId,
        startsAt: new Date(startsAt),
        endsAt: endsAt ? new Date(endsAt) : undefined,
        doorsOpenAt: doorsOpenAt ? new Date(doorsOpenAt) : undefined,
        ...rest,
      },
      include: { venue: true },
    });
  }

  async update(showId: string, id: string, dto: UpdateTerminDto, user: JwtPayload) {
    const current = await this.findOne(showId, id, user);
    if (dto.venueId) await this.venues.assertUsableForTermin(dto.venueId, user);
    const { startsAt, endsAt, doorsOpenAt, mode, seatMapId, ...rest } = dto;

    // Úloha 22/3a: prepínanie režimu GENERAL/SEATMAP + väzba na plánik.
    // Rieši sa pred bežným update-om, aby validácia mohla zlyhať bez zmeny dát.
    if (mode !== undefined || seatMapId !== undefined) {
      await this.applyModeChange(current, mode, seatMapId);
    }

    return this.prisma.termin.update({
      where: { id },
      data: {
        ...(startsAt && { startsAt: new Date(startsAt) }),
        ...(endsAt && { endsAt: new Date(endsAt) }),
        ...(doorsOpenAt && { doorsOpenAt: new Date(doorsOpenAt) }),
        ...rest,
      },
      include: { venue: true },
    });
  }

  /**
   * Úloha 22/3a: nastaví Termin.mode a seatMapId a synchronizuje TerminSection záznamy.
   * - SEATMAP: validuje, že plánik patrí venue termínu; vytvorí TerminSection pre každú sekciu
   *   (default cena 0, existujúce ceny zachová). Zmena plánika je povolená len bez predaja.
   * - GENERAL: zruší väzbu + TerminSection, ale len ak na sekciách nie je žiadny predaj (inak 400).
   */
  private async applyModeChange(
    current: { id: string; venueId: string; mode: TerminMode; seatMapId: string | null },
    mode: TerminMode | undefined,
    seatMapId: string | null | undefined,
  ) {
    const targetMode = mode ?? current.mode;

    if (targetMode === TerminMode.GENERAL) {
      await this.assertNoSectionSales(current.id, 'Termín nie je možné prepnúť na GENERAL – na sekciách už existuje predaj.');
      await this.prisma.$transaction([
        this.prisma.terminSeat.deleteMany({ where: { terminId: current.id } }),
        this.prisma.terminSection.deleteMany({ where: { terminId: current.id } }),
        this.prisma.termin.update({ where: { id: current.id }, data: { mode: TerminMode.GENERAL, seatMapId: null } }),
      ]);
      return;
    }

    // targetMode === SEATMAP
    const targetSeatMapId = seatMapId ?? current.seatMapId;
    if (!targetSeatMapId) {
      throw new BadRequestException('Pre režim SEATMAP musíte zvoliť plánik (seatMapId).');
    }
    const seatMap = await this.prisma.seatMap.findUnique({
      where: { id: targetSeatMapId },
      include: {
        sections: { include: { rows: { include: { seats: { select: { id: true } } } } } },
      },
    });
    if (!seatMap) throw new BadRequestException('Zvolený plánik neexistuje.');
    if (seatMap.venueId !== current.venueId) {
      throw new BadRequestException('Zvolený plánik nepatrí miestu konania termínu.');
    }

    const changingMap = current.seatMapId && current.seatMapId !== targetSeatMapId;
    if (changingMap) {
      await this.assertNoSectionSales(current.id, 'Plánik nie je možné zmeniť – na aktuálnom plániku už existuje predaj.');
      await this.prisma.$transaction([
        this.prisma.terminSeat.deleteMany({ where: { terminId: current.id } }),
        this.prisma.terminSection.deleteMany({ where: { terminId: current.id } }),
      ]);
    }

    // Sedadlá SEATED sekcií → TerminSeat AVAILABLE (úloha 22/3b).
    const seatRows = seatMap.sections
      .filter((s) => s.mode === SectionMode.SEATED)
      .flatMap((s) => s.rows.flatMap((r) => r.seats.map((seat) => ({ terminId: current.id, seatId: seat.id }))));

    await this.prisma.$transaction([
      this.prisma.termin.update({ where: { id: current.id }, data: { mode: TerminMode.SEATMAP, seatMapId: targetSeatMapId } }),
      // Vytvor chýbajúce TerminSection (cena 0); existujúce ostanú nedotknuté vďaka @@unique + skipDuplicates.
      this.prisma.terminSection.createMany({
        data: seatMap.sections.map((s) => ({ terminId: current.id, sectionId: s.id, price: 0 })),
        skipDuplicates: true,
      }),
      // Vytvor TerminSeat (AVAILABLE) pre všetky sedadlá SEATED sekcií; existujúce ostanú vďaka @@unique.
      this.prisma.terminSeat.createMany({
        data: seatRows,
        skipDuplicates: true,
      }),
    ]);
  }

  /** Hodí 400, ak na ktorejkoľvek sekcii termínu existuje predaj (PENDING/PAID OrderItem). */
  private async assertNoSectionSales(terminId: string, message: string) {
    const sold = await this.prisma.orderItem.count({
      where: {
        terminSection: { terminId },
        order: { status: { in: [OrderStatus.PENDING, OrderStatus.PAID] } },
      },
    });
    if (sold > 0) throw new BadRequestException(message);
  }

  /** Úloha 22/3a: zoznam sekcií termínu s cenou + dostupnosťou (organizer pohľad). */
  async listSections(terminId: string, user: JwtPayload) {
    const termin = await this.prisma.termin.findUnique({
      where: { id: terminId },
      include: { show: { select: { organizerId: true } } },
    });
    if (!termin) throw new NotFoundException('Termín neexistuje.');
    if (user.role !== UserRole.SUPERADMIN && user.role !== UserRole.STAFF) {
      if (termin.show.organizerId !== user.organizerId) throw new ForbiddenException();
    }

    const sections = await this.prisma.terminSection.findMany({
      where: { terminId },
      include: { section: true },
      orderBy: { section: { displayOrder: 'asc' } },
    });
    const ids = sections.map((s) => s.id);
    // SECTIONED: predané = súčet quantity OrderItem (PENDING/PAID), ako GENERAL.
    const sold = ids.length
      ? await this.prisma.orderItem.groupBy({
          by: ['terminSectionId'],
          where: { terminSectionId: { in: ids }, order: { status: { in: [OrderStatus.PENDING, OrderStatus.PAID] } } },
          _sum: { quantity: true },
        })
      : [];
    const soldMap = new Map(sold.map((r) => [r.terminSectionId, r._sum.quantity ?? 0]));

    // SEATED (úloha 22/3b): obsadenosť z TerminSeat, zoskupené podľa sekcie sedadla.
    const terminSeats = await this.prisma.terminSeat.findMany({
      where: { terminId },
      select: { status: true, seat: { select: { row: { select: { sectionId: true } } } } },
    });
    const seatAgg = new Map<string, { total: number; taken: number }>();
    for (const tseat of terminSeats) {
      const secId = tseat.seat.row.sectionId;
      const e = seatAgg.get(secId) ?? { total: 0, taken: 0 };
      e.total++;
      if (tseat.status !== SeatStatus.AVAILABLE) e.taken++;
      seatAgg.set(secId, e);
    }

    return {
      mode: termin.mode,
      seatMapId: termin.seatMapId,
      sections: sections.map((ts) => {
        const isSeated = ts.section.mode === SectionMode.SEATED;
        const agg = seatAgg.get(ts.sectionId);
        const soldQty = isSeated ? (agg?.taken ?? 0) : (soldMap.get(ts.id) ?? 0);
        const capacity = isSeated ? (agg?.total ?? 0) : ts.section.capacity;
        return {
          id: ts.id,
          sectionId: ts.sectionId,
          name: ts.section.name,
          sectionMode: ts.section.mode,
          capacity,
          price: Number(ts.price),
          currency: ts.currency,
          sold: soldQty,
          remaining: capacity != null ? Math.max(0, capacity - soldQty) : null,
          sellable: true, // SECTIONED aj SEATED predajné (3b)
        };
      }),
    };
  }

  /** Úloha 22/3a: nastav cenu (a menu) sekcie termínu. */
  async setSectionPrice(terminId: string, terminSectionId: string, dto: UpdateTerminSectionDto, user: JwtPayload) {
    const ts = await this.prisma.terminSection.findUnique({
      where: { id: terminSectionId },
      include: { termin: { include: { show: { select: { organizerId: true } } } } },
    });
    if (!ts || ts.terminId !== terminId) throw new NotFoundException('Sekcia termínu neexistuje.');
    if (user.role !== UserRole.SUPERADMIN && user.role !== UserRole.STAFF) {
      if (ts.termin.show.organizerId !== user.organizerId) throw new ForbiddenException();
    }
    return this.prisma.terminSection.update({
      where: { id: terminSectionId },
      data: { price: dto.price, ...(dto.currency && { currency: dto.currency }) },
    });
  }

  async remove(showId: string, id: string, user: JwtPayload) {
    await this.findOne(showId, id, user);
    return this.prisma.termin.delete({ where: { id } });
  }
}
