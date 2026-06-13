import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma, SectionMode } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { VenuesService } from '../venues/venues.service';
import { JwtPayload } from '../casl/casl-ability.factory';
import {
  CreateSeatMapDto,
  UpdateSeatMapDto,
  CreateSectionDto,
  UpdateSectionDto,
  GenerateSeatsDto,
  RowLabelStyle,
} from './dto/seatmap.dto';

@Injectable()
export class SeatmapsService {
  constructor(
    private prisma: PrismaService,
    private venues: VenuesService,
  ) {}

  // ── Label helpers (generátor) ─────────────────────────────
  /** 0-based index → bijektívny base-26 label: 0→A, 25→Z, 26→AA, 27→AB ... */
  private alphaLabel(index: number): string {
    let n = index + 1;
    let s = '';
    while (n > 0) {
      n--;
      s = String.fromCharCode(65 + (n % 26)) + s;
      n = Math.floor(n / 26);
    }
    return s;
  }

  private rowLabel(style: RowLabelStyle, index: number): string {
    return style === RowLabelStyle.ALPHA
      ? this.alphaLabel(index)
      : String(index + 1);
  }

  // ── Súhrn kapacity ────────────────────────────────────────
  /** SECTIONED → capacity (||0); SEATED → počet sedadiel. */
  private sectionCapacity(s: {
    mode: SectionMode;
    capacity: number | null;
    rows: { _count: { seats: number } }[];
  }): number {
    if (s.mode === SectionMode.SECTIONED) return s.capacity ?? 0;
    return s.rows.reduce((sum, r) => sum + r._count.seats, 0);
  }

  // ── SeatMap CRUD ──────────────────────────────────────────

  /** C1: POST /v1/venues/:venueId/seatmaps */
  async createMap(venueId: string, dto: CreateSeatMapDto, user: JwtPayload) {
    await this.venues.getVenueForManage(venueId, user);

    const existing = await this.prisma.seatMap.count({ where: { venueId } });
    // Prvá mapa venue je automaticky default; inak rešpektuj dto.isDefault.
    const isDefault = existing === 0 ? true : dto.isDefault === true;

    return this.prisma.$transaction(async (tx) => {
      if (isDefault && existing > 0) {
        await tx.seatMap.updateMany({
          where: { venueId, isDefault: true },
          data: { isDefault: false },
        });
      }
      return tx.seatMap.create({
        data: { venueId, name: dto.name, isDefault },
      });
    });
  }

  /** C2: GET /v1/venues/:venueId/seatmaps – zoznam + súhrn. */
  async listMaps(venueId: string, user: JwtPayload) {
    await this.venues.getVenueForRead(venueId, user);

    const maps = await this.prisma.seatMap.findMany({
      where: { venueId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      include: {
        sections: {
          select: {
            mode: true,
            capacity: true,
            rows: { select: { _count: { select: { seats: true } } } },
          },
        },
      },
    });

    return maps.map((m) => ({
      id: m.id,
      name: m.name,
      isDefault: m.isDefault,
      isActive: m.isActive,
      createdAt: m.createdAt,
      sectionCount: m.sections.length,
      totalCapacity: m.sections.reduce(
        (sum, s) => sum + this.sectionCapacity(s),
        0,
      ),
    }));
  }

  /** Načíta mapu + overí prístup cez jej venue. */
  private async loadMap(id: string, user: JwtPayload, manage: boolean) {
    const map = await this.prisma.seatMap.findUnique({ where: { id } });
    if (!map) throw new NotFoundException('Plán sedenia neexistuje.');
    if (manage) await this.venues.getVenueForManage(map.venueId, user);
    else await this.venues.getVenueForRead(map.venueId, user);
    return map;
  }

  /** C3: GET /v1/seatmaps/:id – plná mapa nested + totalCapacity. */
  async getMap(id: string, user: JwtPayload) {
    await this.loadMap(id, user, false);

    const map = await this.prisma.seatMap.findUnique({
      where: { id },
      include: {
        sections: {
          orderBy: { displayOrder: 'asc' },
          include: {
            rows: {
              orderBy: { displayOrder: 'asc' },
              include: { seats: { orderBy: { label: 'asc' } } },
            },
          },
        },
      },
    });

    let totalCapacity = 0;
    for (const s of map.sections) {
      totalCapacity +=
        s.mode === SectionMode.SECTIONED
          ? s.capacity ?? 0
          : s.rows.reduce((sum, r) => sum + r.seats.length, 0);
    }
    return { ...map, totalCapacity };
  }

  /** C4: PATCH /v1/seatmaps/:id */
  async updateMap(id: string, dto: UpdateSeatMapDto, user: JwtPayload) {
    const map = await this.loadMap(id, user, true);

    return this.prisma.$transaction(async (tx) => {
      // isDefault=true zhodí default z ostatných máp toho istého venue.
      if (dto.isDefault === true) {
        await tx.seatMap.updateMany({
          where: { venueId: map.venueId, isDefault: true, id: { not: id } },
          data: { isDefault: false },
        });
      }
      return tx.seatMap.update({
        where: { id },
        data: {
          name: dto.name,
          isDefault: dto.isDefault,
          isActive: dto.isActive,
        },
      });
    });
  }

  /** C5: DELETE /v1/seatmaps/:id – cascade. */
  async deleteMap(id: string, user: JwtPayload) {
    await this.loadMap(id, user, true);
    await this.prisma.seatMap.delete({ where: { id } });
    return { deleted: true };
  }

  // ── Sections ──────────────────────────────────────────────

  /** C6: POST /v1/seatmaps/:id/sections */
  async createSection(
    seatMapId: string,
    dto: CreateSectionDto,
    user: JwtPayload,
  ) {
    await this.loadMap(seatMapId, user, true);

    if (dto.mode === SectionMode.SECTIONED) {
      if (dto.capacity == null) {
        throw new BadRequestException('SECTIONED sekcia vyžaduje capacity.');
      }
      if (dto.generate) {
        throw new BadRequestException(
          'generate je povolené len pre SEATED sekciu.',
        );
      }
    }

    const displayOrder =
      dto.displayOrder ??
      (await this.prisma.section.count({ where: { seatMapId } }));

    return this.prisma.$transaction(async (tx) => {
      const section = await tx.section.create({
        data: {
          seatMapId,
          name: dto.name,
          mode: dto.mode,
          capacity: dto.mode === SectionMode.SECTIONED ? dto.capacity : null,
          displayOrder,
          color: dto.color,
        },
      });

      let rowCount = 0;
      let seatCount = 0;
      let sampleLabels: string[] = [];

      if (dto.mode === SectionMode.SEATED && dto.generate) {
        const gen = dto.generate;
        const start = gen.seatStartNumber ?? 1;

        for (let r = 0; r < gen.rowCount; r++) {
          const label = this.rowLabel(gen.rowLabelStyle, r);
          const row = await tx.row.create({
            data: { sectionId: section.id, label, displayOrder: r },
          });
          const seats: Prisma.SeatCreateManyInput[] = [];
          for (let i = 0; i < gen.seatsPerRow; i++) {
            const seatNum = start + i;
            // label sedadla = rowLabel + číslo, napr. "A1", "B12"
            seats.push({ rowId: row.id, label: `${label}${seatNum}` });
          }
          await tx.seat.createMany({ data: seats });
          rowCount++;
          seatCount += seats.length;
          if (r === 0) sampleLabels = seats.map((s) => s.label);
        }
      }

      return {
        ...section,
        rowCount,
        seatCount,
        sampleSeatLabels: sampleLabels.slice(0, 3),
      };
    });
  }

  private async loadSection(id: string, user: JwtPayload, manage: boolean) {
    const section = await this.prisma.section.findUnique({
      where: { id },
      include: { seatMap: { select: { venueId: true } } },
    });
    if (!section) throw new NotFoundException('Sekcia neexistuje.');
    if (manage)
      await this.venues.getVenueForManage(section.seatMap.venueId, user);
    else await this.venues.getVenueForRead(section.seatMap.venueId, user);
    return section;
  }

  /** C7: PATCH /v1/sections/:id (mode immutable). */
  async updateSection(id: string, dto: UpdateSectionDto, user: JwtPayload) {
    const section = await this.loadSection(id, user, true);
    // capacity má zmysel len pre SECTIONED
    if (dto.capacity != null && section.mode !== SectionMode.SECTIONED) {
      throw new BadRequestException(
        'capacity sa dá nastaviť len pri SECTIONED sekcii.',
      );
    }
    return this.prisma.section.update({
      where: { id },
      data: {
        name: dto.name,
        capacity: dto.capacity,
        displayOrder: dto.displayOrder,
        color: dto.color,
      },
    });
  }

  /** C8: DELETE /v1/sections/:id – cascade. */
  async deleteSection(id: string, user: JwtPayload) {
    await this.loadSection(id, user, true);
    await this.prisma.section.delete({ where: { id } });
    return { deleted: true };
  }
}
