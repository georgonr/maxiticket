import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes, createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { UserRole } from '@prisma/client';
import { UpdateUserDto, UpdateUserRoleDto } from './dto/update-user.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { canCreate, canManageTarget } from './role-hierarchy';
import { JwtPayload } from '../casl/casl-ability.factory';

const TENANT_ROLES: UserRole[] = [UserRole.ORGANIZER_OWNER, UserRole.ORGANIZER_MEMBER, UserRole.SCANNER];
const INVITE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 dní

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private prisma: PrismaService,
    private mail: MailService,
    private config: ConfigService,
  ) {}

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

  /**
   * Vytvorenie používateľa + pozvánka (krok B). Autorizáciu vynucuje CREATABLE_BY
   * matica – to blokuje aj priame API obídenie UI (napr. PLATFORM_ADMIN → SUPERADMIN).
   */
  async create(dto: CreateUserDto, actor: JwtPayload) {
    // KRITICKÉ: smie actor vôbec vytvoriť túto rolu?
    if (!canCreate(actor.role, dto.role)) {
      throw new ForbiddenException('Nemáte oprávnenie vytvoriť používateľa s touto rolou.');
    }

    const needsOrg = TENANT_ROLES.includes(dto.role);
    if (needsOrg && !dto.organizerId) {
      throw new BadRequestException('organizerId je povinný pre organizátorské role.');
    }

    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('E-mail je už zaregistrovaný.');

    let organizerName = 'TicketAll';
    if (needsOrg) {
      const org = await this.prisma.organizer.findUnique({
        where: { id: dto.organizerId! },
        select: { name: true },
      });
      if (!org) throw new BadRequestException('Organizátor neexistuje.');
      organizerName = org.name;
    }

    const created = await this.prisma.user.create({
      data: {
        email: dto.email,
        firstName: dto.firstName?.trim() || null,
        lastName: dto.lastName?.trim() || null,
        role: dto.role,
        organizerId: needsOrg ? dto.organizerId! : null,
        isActive: true,
        emailVerified: false,
        passwordHash: null, // nastaví sa prijatím pozvánky
      },
      select: this.safeSelect(),
    });

    await this.sendInvite(
      { id: created.id, email: created.email, firstName: created.firstName },
      organizerName,
      dto.locale,
    );

    return created;
  }

  async update(id: string, dto: UpdateUserDto, user: JwtPayload) {
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target) throw new NotFoundException('User not found');
    this.assertAccessToUser(target, user);
    return this.prisma.user.update({ where: { id }, data: dto, select: this.safeSelect() });
  }

  async updateRole(id: string, dto: UpdateUserRoleDto, user: JwtPayload) {
    // Nikto nesmie meniť vlastnú rolu (žiadne self-povýšenie).
    if (id === user.sub) throw new ForbiddenException('Nemôžete zmeniť vlastnú rolu.');

    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target) throw new NotFoundException('User not found');

    // ORGANIZER_OWNER – zachovaný pôvodný tenant režim (len TENANT_ROLES vo vlastnom orgu).
    if (user.role === UserRole.ORGANIZER_OWNER) {
      if (target.organizerId !== user.organizerId) throw new ForbiddenException();
      if (!TENANT_ROLES.includes(dto.role)) throw new BadRequestException('Cannot assign platform roles');
      const organizerId = user.organizerId;
      return this.prisma.user.update({
        where: { id },
        data: { role: dto.role, organizerId },
        select: this.safeSelect(),
      });
    }

    // Platformoví actori (SUPERADMIN / PLATFORM_ADMIN / …) – hierarchia:
    // 1) smie actor vôbec siahnuť na CIEĽOVÉHO používateľa (podľa jeho aktuálnej role)?
    if (!canManageTarget(user.role, target.role)) {
      throw new ForbiddenException('Nemáte oprávnenie spravovať tohto používateľa.');
    }
    // 2) smie actor PRIRADIŤ novú rolu (nikto nevyrobí SUPERADMIN/PLATFORM_ADMIN mimo matice)?
    if (!canCreate(user.role, dto.role)) {
      throw new ForbiddenException('Nemáte oprávnenie priradiť túto rolu.');
    }

    const organizerId = TENANT_ROLES.includes(dto.role) ? (dto.organizerId ?? target.organizerId) : null;

    return this.prisma.user.update({
      where: { id },
      data: { role: dto.role, organizerId },
      select: this.safeSelect(),
    });
  }

  /** Soft-delete = deaktivácia (isActive=false). */
  async remove(id: string, user: JwtPayload) {
    return this.setActive(id, false, user);
  }

  async setActive(id: string, isActive: boolean, user: JwtPayload) {
    if (id === user.sub) throw new ForbiddenException('Nemôžete deaktivovať vlastný účet.');
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target) throw new NotFoundException('User not found');
    if (!canManageTarget(user.role, target.role)) {
      throw new ForbiddenException('Nemáte oprávnenie spravovať tohto používateľa.');
    }
    await this.prisma.user.update({ where: { id }, data: { isActive } });
  }

  private async sendInvite(
    member: { id: string; email: string; firstName: string | null },
    organizerName: string,
    locale?: string,
  ) {
    // Zruš predošlé nepoužité tokeny
    await this.prisma.passwordResetToken.updateMany({
      where: { userId: member.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    await this.prisma.passwordResetToken.create({
      data: { userId: member.id, tokenHash, expiresAt: new Date(Date.now() + INVITE_EXPIRY_MS) },
    });

    const base = this.config.get<string>('EMAIL_BASE_URL') ?? 'https://ticketall.eu';
    const inviteLink = `${base}/reset-password?token=${rawToken}`;

    await this.mail
      .sendTeamInvite({
        to: member.email,
        locale,
        organizerName,
        inviteLink,
        firstName: member.firstName ?? undefined,
      })
      .catch((e) => this.logger.error(`Invite email failed for ${member.email}: ${e.message}`));
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
