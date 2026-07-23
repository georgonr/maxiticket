import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from '../casl/casl-ability.factory';
import { UserRole } from '@prisma/client';
import { CreateTicketTypeDto, UpdateTicketTypeDto } from './dto/ticket-type.dto';

@Injectable()
export class TicketTypesService {
  constructor(private prisma: PrismaService) {}

  private async assertTerminAccess(terminId: string, user: JwtPayload) {
    const termin = await this.prisma.termin.findUnique({
      where: { id: terminId },
      include: { show: { select: { organizerId: true } } },
    });
    if (!termin) throw new NotFoundException('Termin not found');
    if (user.role !== UserRole.SUPERADMIN && user.role !== UserRole.STAFF) {
      if (termin.show.organizerId !== user.organizerId) throw new ForbiddenException();
    }
    return termin;
  }

  /**
   * Okno predaja: Predaj od < Predaj do (ak sú obe zadané) a Predaj do <= začiatok podujatia.
   * Vyhodí BadRequest so stabilným errorCode, ktorý frontend mapuje na lokalizovanú hlášku.
   */
  private validateSaleWindow(
    saleStartsAt: Date | null | undefined,
    saleEndsAt: Date | null | undefined,
    terminStartsAt: Date,
  ) {
    if (saleStartsAt && saleEndsAt && saleStartsAt >= saleEndsAt) {
      throw new BadRequestException({
        errorCode: 'SALE_WINDOW_INVALID',
        message: 'Predaj musí končiť po jeho začiatku (Predaj od < Predaj do).',
      });
    }
    if (saleEndsAt && saleEndsAt > terminStartsAt) {
      throw new BadRequestException({
        errorCode: 'SALE_ENDS_AFTER_EVENT',
        message: 'Predaj nemôže končiť po začiatku podujatia.',
      });
    }
  }

  /** Počet už predaných/rezervovaných kusov daného typu (order PENDING alebo PAID). */
  private async soldCount(ticketTypeId: string) {
    const agg = await this.prisma.orderItem.aggregate({
      where: { ticketTypeId, order: { status: { in: ['PENDING', 'PAID'] } } },
      _sum: { quantity: true },
    });
    return agg._sum.quantity ?? 0;
  }

  async findAll(terminId: string, user: JwtPayload) {
    // Tenant scoping (krok 52): organizer vidí typy lístkov LEN svojho termínu. Predtým sa
    // `user` vôbec neprijímal → cross-tenant read (ceny/kapacity cudzieho podujatia).
    // Verejný predaj používa /v1/public/* (nie tento auth endpoint).
    await this.assertTerminAccess(terminId, user);
    return this.prisma.ticketType.findMany({
      where: { terminId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async create(terminId: string, dto: CreateTicketTypeDto, user: JwtPayload) {
    const termin = await this.assertTerminAccess(terminId, user);
    const { saleStartsAt, saleEndsAt, price, ...rest } = dto;
    this.validateSaleWindow(
      saleStartsAt ? new Date(saleStartsAt) : null,
      saleEndsAt ? new Date(saleEndsAt) : null,
      termin.startsAt,
    );
    return this.prisma.ticketType.create({
      data: {
        terminId,
        price,
        saleStartsAt: saleStartsAt ? new Date(saleStartsAt) : undefined,
        saleEndsAt: saleEndsAt ? new Date(saleEndsAt) : undefined,
        ...rest,
      },
    });
  }

  async update(terminId: string, id: string, dto: UpdateTicketTypeDto, user: JwtPayload) {
    const termin = await this.assertTerminAccess(terminId, user);
    const tt = await this.prisma.ticketType.findUnique({ where: { id } });
    if (!tt || tt.terminId !== terminId) throw new NotFoundException();
    const { saleStartsAt, saleEndsAt, ...rest } = dto;

    // Capacity guard: kapacita nesmie klesnúť pod počet už predaných lístkov.
    if (dto.totalQuantity != null) {
      const sold = await this.soldCount(id);
      if (dto.totalQuantity < sold) {
        throw new BadRequestException({
          errorCode: 'CAPACITY_BELOW_SOLD',
          soldCount: sold,
          message: `Kapacita nesmie klesnúť pod počet už predaných lístkov (${sold}).`,
        });
      }
    }

    // Okno predaja: použijeme efektívne hodnoty (nezmenené polia z existujúceho záznamu).
    const effStart =
      saleStartsAt !== undefined ? (saleStartsAt ? new Date(saleStartsAt) : null) : tt.saleStartsAt;
    const effEnd =
      saleEndsAt !== undefined ? (saleEndsAt ? new Date(saleEndsAt) : null) : tt.saleEndsAt;
    this.validateSaleWindow(effStart, effEnd, termin.startsAt);

    return this.prisma.ticketType.update({
      where: { id },
      data: {
        ...rest,
        ...(saleStartsAt !== undefined && { saleStartsAt: saleStartsAt ? new Date(saleStartsAt) : null }),
        ...(saleEndsAt !== undefined && { saleEndsAt: saleEndsAt ? new Date(saleEndsAt) : null }),
      },
    });
  }

  async remove(terminId: string, id: string, user: JwtPayload) {
    await this.assertTerminAccess(terminId, user);
    const tt = await this.prisma.ticketType.findUnique({ where: { id } });
    if (!tt || tt.terminId !== terminId) throw new NotFoundException();
    return this.prisma.ticketType.delete({ where: { id } });
  }
}
