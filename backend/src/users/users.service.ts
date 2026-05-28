import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@prisma/client';
import { UpdateUserDto, UpdateUserRoleDto } from './dto/update-user.dto';
import { JwtPayload } from '../casl/casl-ability.factory';

const TENANT_ROLES: UserRole[] = [UserRole.ORGANIZER_OWNER, UserRole.ORGANIZER_MEMBER, UserRole.SCANNER];

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll(user: JwtPayload) {
    if (user.role === UserRole.SUPERADMIN || user.role === UserRole.STAFF) {
      return this.prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        select: this.safeSelect(),
      });
    }
    if (!user.organizerId) throw new ForbiddenException();
    return this.prisma.user.findMany({
      where: { organizerId: user.organizerId },
      select: this.safeSelect(),
    });
  }

  async findOne(id: string, user: JwtPayload) {
    const target = await this.prisma.user.findUnique({ where: { id }, select: this.safeSelect() });
    if (!target) throw new NotFoundException('User not found');
    this.assertAccessToUser(target as any, user);
    return target;
  }

  async update(id: string, dto: UpdateUserDto, user: JwtPayload) {
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target) throw new NotFoundException('User not found');
    this.assertAccessToUser(target, user);
    return this.prisma.user.update({ where: { id }, data: dto, select: this.safeSelect() });
  }

  async updateRole(id: string, dto: UpdateUserRoleDto, user: JwtPayload) {
    if (user.role !== UserRole.SUPERADMIN && user.role !== UserRole.STAFF && user.role !== UserRole.ORGANIZER_OWNER) {
      throw new ForbiddenException('Insufficient permissions');
    }

    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target) throw new NotFoundException('User not found');

    // ORGANIZER_OWNER can only manage tenant-scoped roles within their org
    if (user.role === UserRole.ORGANIZER_OWNER) {
      if (target.organizerId !== user.organizerId) throw new ForbiddenException();
      if (!TENANT_ROLES.includes(dto.role)) throw new BadRequestException('Cannot assign platform roles');
    }

    const organizerId = TENANT_ROLES.includes(dto.role) ? (dto.organizerId ?? target.organizerId) : null;

    return this.prisma.user.update({
      where: { id },
      data: { role: dto.role, organizerId },
      select: this.safeSelect(),
    });
  }

  async remove(id: string, user: JwtPayload) {
    if (user.role !== UserRole.SUPERADMIN && user.role !== UserRole.STAFF) {
      throw new ForbiddenException('Insufficient permissions');
    }
    await this.prisma.user.findUniqueOrThrow({ where: { id } });
    await this.prisma.user.update({ where: { id }, data: { isActive: false } });
  }

  private assertAccessToUser(target: { organizerId?: string | null; id: string }, user: JwtPayload) {
    if (user.role === UserRole.SUPERADMIN || user.role === UserRole.STAFF) return;
    // Users can see themselves
    if (target.id === user.sub) return;
    // Tenant owners/members can see users in their org
    if (user.organizerId && target.organizerId === user.organizerId) return;
    throw new ForbiddenException('Access denied');
  }

  private safeSelect() {
    return {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      role: true,
      organizerId: true,
      isActive: true,
      emailVerified: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
    };
  }
}
