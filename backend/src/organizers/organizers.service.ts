import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole, OrganizerStatus } from '@prisma/client';
import { UpdateOrganizerDto, UpdateOrganizerStatusDto } from './dto/update-organizer.dto';
import { JwtPayload } from '../casl/casl-ability.factory';

@Injectable()
export class OrganizersService {
  constructor(private prisma: PrismaService) {}

  async findAll(user: JwtPayload) {
    // SUPERADMIN and STAFF see all; others see only their own
    if (user.role === UserRole.SUPERADMIN || user.role === UserRole.STAFF) {
      return this.prisma.organizer.findMany({ orderBy: { createdAt: 'desc' } });
    }
    if (!user.organizerId) return [];
    return this.prisma.organizer.findMany({ where: { id: user.organizerId } });
  }

  async findOne(id: string, user: JwtPayload) {
    this.assertTenantAccess(id, user);
    const org = await this.prisma.organizer.findUnique({ where: { id } });
    if (!org) throw new NotFoundException('Organizer not found');
    return org;
  }

  async update(id: string, dto: UpdateOrganizerDto, user: JwtPayload) {
    this.assertTenantAccess(id, user);
    await this.findOne(id, user); // ensures exists
    return this.prisma.organizer.update({ where: { id }, data: dto as any });
  }

  async updateStatus(id: string, dto: UpdateOrganizerStatusDto, user: JwtPayload) {
    // Only platform roles can change status
    if (user.role !== UserRole.SUPERADMIN && user.role !== UserRole.STAFF) {
      throw new ForbiddenException('Insufficient permissions');
    }
    const org = await this.prisma.organizer.findUnique({ where: { id } });
    if (!org) throw new NotFoundException('Organizer not found');
    return this.prisma.organizer.update({ where: { id }, data: { status: dto.status } });
  }

  private assertTenantAccess(organizerId: string, user: JwtPayload) {
    if (user.role === UserRole.SUPERADMIN || user.role === UserRole.STAFF) return;
    if (user.organizerId !== organizerId) throw new ForbiddenException('Access denied');
  }
}
