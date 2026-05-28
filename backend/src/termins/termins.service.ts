import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from '../casl/casl-ability.factory';
import { UserRole } from '@prisma/client';
import { CreateTerminDto, UpdateTerminDto } from './dto/termin.dto';

@Injectable()
export class TerminsService {
  constructor(private prisma: PrismaService) {}

  private async assertShowAccess(showId: string, user: JwtPayload) {
    const show = await this.prisma.show.findUnique({ where: { id: showId } });
    if (!show) throw new NotFoundException('Show not found');
    if (user.role !== UserRole.SUPERADMIN && user.role !== UserRole.STAFF) {
      if (show.organizerId !== user.organizerId) throw new ForbiddenException();
    }
    return show;
  }

  findAll(showId: string, user: JwtPayload) {
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
    await this.findOne(showId, id, user);
    const { startsAt, endsAt, doorsOpenAt, ...rest } = dto;
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

  async remove(showId: string, id: string, user: JwtPayload) {
    await this.findOne(showId, id, user);
    return this.prisma.termin.delete({ where: { id } });
  }
}
