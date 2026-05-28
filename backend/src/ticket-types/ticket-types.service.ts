import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
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

  findAll(terminId: string) {
    return this.prisma.ticketType.findMany({
      where: { terminId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async create(terminId: string, dto: CreateTicketTypeDto, user: JwtPayload) {
    await this.assertTerminAccess(terminId, user);
    const { saleStartsAt, saleEndsAt, price, ...rest } = dto;
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
    await this.assertTerminAccess(terminId, user);
    const tt = await this.prisma.ticketType.findUnique({ where: { id } });
    if (!tt || tt.terminId !== terminId) throw new NotFoundException();
    const { saleStartsAt, saleEndsAt, ...rest } = dto;
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
