import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole, OrganizerStatus } from '@prisma/client';
import { UpdateOrganizerDto, UpdateOrganizerStatusDto } from './dto/update-organizer.dto';
import { UpdateOrganizerBusinessDto } from './dto/update-organizer-business.dto';
import { JwtPayload } from '../casl/casl-ability.factory';

@Injectable()
export class OrganizersService {
  constructor(private prisma: PrismaService) {}

  /**
   * BEZPEČNOSŤ (per-org fakturácia): organizer-facing endpointy vracajú celý
   * Organizer objekt → fakturačné polia by organizátor videl. Tu ich VŽDY
   * odstránime. Čítať/upraviť ich smie LEN dedikovaný admin/organizers/:id/billing.
   */
  private stripBilling<T extends Record<string, unknown>>(org: T): T {
    if (!org) return org;
    const rest = { ...org };
    delete (rest as Record<string, unknown>).commissionPercent;
    delete (rest as Record<string, unknown>).vatPercent;
    delete (rest as Record<string, unknown>).feesIncluded;
    delete (rest as Record<string, unknown>).customerFeePercent;
    delete (rest as Record<string, unknown>).billingMode;
    delete (rest as Record<string, unknown>).refundFeePerTicketCents;
    return rest;
  }

  async findAll(user: JwtPayload) {
    // SUPERADMIN and STAFF see all; others see only their own
    if (user.role === UserRole.SUPERADMIN || user.role === UserRole.STAFF) {
      return (await this.prisma.organizer.findMany({ orderBy: { createdAt: 'desc' } })).map((o) => this.stripBilling(o));
    }
    if (!user.organizerId) return [];
    return (await this.prisma.organizer.findMany({ where: { id: user.organizerId } })).map((o) => this.stripBilling(o));
  }

  async findOne(id: string, user: JwtPayload) {
    this.assertTenantAccess(id, user);
    const org = await this.prisma.organizer.findUnique({ where: { id } });
    if (!org) throw new NotFoundException('Organizer not found');
    return this.stripBilling(org);
  }

  async update(id: string, dto: UpdateOrganizerDto, user: JwtPayload) {
    this.assertTenantAccess(id, user);
    await this.findOne(id, user); // ensures exists
    return this.stripBilling(await this.prisma.organizer.update({ where: { id }, data: dto as any }));
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

  async updateBusiness(dto: UpdateOrganizerBusinessDto, user: JwtPayload, organizerIdOverride?: string) {
    let targetId: string;
    if (user.role === UserRole.SUPERADMIN && organizerIdOverride) {
      targetId = organizerIdOverride;
    } else if (user.organizerId) {
      targetId = user.organizerId;
    } else {
      throw new ForbiddenException('No organizer associated with this account');
    }
    this.assertTenantAccess(targetId, user);
    const org = await this.prisma.organizer.findUnique({ where: { id: targetId } });
    if (!org) throw new NotFoundException('Organizer not found');
    return this.stripBilling(await this.prisma.organizer.update({ where: { id: targetId }, data: dto as any }));
  }

  private assertTenantAccess(organizerId: string, user: JwtPayload) {
    if (user.role === UserRole.SUPERADMIN || user.role === UserRole.STAFF) return;
    if (user.organizerId !== organizerId) throw new ForbiddenException('Access denied');
  }
}
