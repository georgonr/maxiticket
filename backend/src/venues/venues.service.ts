import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from '../casl/casl-ability.factory';
import { UserRole } from '@prisma/client';
import { CreateVenueDto, UpdateVenueDto } from './dto/venue.dto';

@Injectable()
export class VenuesService {
  constructor(private prisma: PrismaService) {}

  private orgId(user: JwtPayload): string {
    if (!user.organizerId) throw new ForbiddenException();
    return user.organizerId;
  }

  findAll(user: JwtPayload) {
    if (user.role === UserRole.SUPERADMIN || user.role === UserRole.STAFF) {
      return this.prisma.venue.findMany({ orderBy: { name: 'asc' } });
    }
    return this.prisma.venue.findMany({
      where: { organizerId: this.orgId(user) },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string, user: JwtPayload) {
    const v = await this.prisma.venue.findUnique({ where: { id } });
    if (!v) throw new NotFoundException();
    this.assertAccess(v.organizerId, user);
    return v;
  }

  create(dto: CreateVenueDto, user: JwtPayload) {
    return this.prisma.venue.create({
      data: { ...dto, organizerId: this.orgId(user) },
    });
  }

  async update(id: string, dto: UpdateVenueDto, user: JwtPayload) {
    await this.findOne(id, user);
    return this.prisma.venue.update({ where: { id }, data: dto });
  }

  async remove(id: string, user: JwtPayload) {
    await this.findOne(id, user);
    return this.prisma.venue.delete({ where: { id } });
  }

  private assertAccess(organizerId: string, user: JwtPayload) {
    if (user.role === UserRole.SUPERADMIN || user.role === UserRole.STAFF) return;
    if (user.organizerId !== organizerId) throw new ForbiddenException();
  }
}
