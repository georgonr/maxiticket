import {
  Injectable,
  Logger,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes, createHash } from 'crypto';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { JwtPayload } from '../casl/casl-ability.factory';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';

const INVITE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 dní

interface MemberRow {
  id: string;
  email: string;
  firstName: string | null;
  isActive: boolean;
  passwordHash: string | null;
  lastLoginAt: Date | null;
  createdAt: Date;
}

@Injectable()
export class MembersService {
  private readonly logger = new Logger(MembersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  private isSuperOrStaff(user: JwtPayload): boolean {
    return user.role === UserRole.SUPERADMIN || user.role === UserRole.STAFF;
  }

  private resolveOrganizerId(user: JwtPayload, requested?: string): string {
    if (this.isSuperOrStaff(user)) {
      if (!requested) throw new BadRequestException('organizerId je povinný pre SUPERADMIN/STAFF.');
      return requested;
    }
    if (!user.organizerId) throw new ForbiddenException();
    if (requested && requested !== user.organizerId) throw new ForbiddenException();
    return user.organizerId;
  }

  private assertOwns(target: { organizerId: string | null }, user: JwtPayload) {
    if (this.isSuperOrStaff(user)) return;
    if (target.organizerId !== user.organizerId) throw new ForbiddenException();
  }

  /** pending = člen ešte nenastavil heslo (pozvánka neprijatá). */
  private serialize(m: MemberRow) {
    return {
      id: m.id,
      email: m.email,
      name: m.firstName,
      isActive: m.isActive,
      pending: m.passwordHash == null,
      lastLoginAt: m.lastLoginAt,
      createdAt: m.createdAt,
    };
  }

  private async sendInvite(member: { id: string; email: string; firstName: string | null }, organizerId: string, locale?: string) {
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

    const org = await this.prisma.organizer.findUnique({
      where: { id: organizerId },
      select: { name: true },
    });
    const base = this.config.get<string>('EMAIL_BASE_URL') ?? 'https://ticketall.eu';
    const inviteLink = `${base}/reset-password?token=${rawToken}`;

    await this.mail
      .sendTeamInvite({
        to: member.email,
        locale,
        organizerName: org?.name ?? 'TicketAll',
        inviteLink,
        firstName: member.firstName ?? undefined,
      })
      .catch((e) => this.logger.error(`Team invite email failed for ${member.email}: ${e.message}`));
  }

  async create(dto: CreateMemberDto, user: JwtPayload) {
    const organizerId = this.resolveOrganizerId(user, dto.organizerId);

    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('E-mail je už zaregistrovaný.');

    const member = await this.prisma.user.create({
      data: {
        email: dto.email,
        firstName: dto.name?.trim() || null,
        role: UserRole.ORGANIZER_MEMBER,
        organizerId,
        isActive: true,
        emailVerified: false,
        passwordHash: null, // nastaví sa prijatím pozvánky
      },
    });

    await this.sendInvite(member, organizerId, dto.locale);
    return this.serialize(member as MemberRow);
  }

  async list(user: JwtPayload, organizerId?: string) {
    const orgId = this.resolveOrganizerId(user, organizerId);
    const rows = await this.prisma.user.findMany({
      where: { role: UserRole.ORGANIZER_MEMBER, organizerId: orgId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, email: true, firstName: true, isActive: true,
        passwordHash: true, lastLoginAt: true, createdAt: true,
      },
    });
    return rows.map((r) => this.serialize(r));
  }

  private async findMemberOr404(id: string) {
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target || target.role !== UserRole.ORGANIZER_MEMBER) {
      throw new NotFoundException('Člen tímu neexistuje.');
    }
    return target;
  }

  async setActive(id: string, dto: UpdateMemberDto, user: JwtPayload) {
    const target = await this.findMemberOr404(id);
    this.assertOwns(target, user);
    const updated = await this.prisma.user.update({
      where: { id },
      data: { isActive: dto.isActive },
      select: {
        id: true, email: true, firstName: true, isActive: true,
        passwordHash: true, lastLoginAt: true, createdAt: true,
      },
    });
    return this.serialize(updated);
  }

  async resendInvite(id: string, user: JwtPayload, locale?: string) {
    const target = await this.findMemberOr404(id);
    this.assertOwns(target, user);
    if (target.passwordHash != null) {
      throw new BadRequestException('Člen už má aktívny účet – pozvánku nie je možné znova poslať.');
    }
    await this.sendInvite(target, target.organizerId!, locale);
    return { sent: true, email: target.email };
  }

  async remove(id: string, user: JwtPayload) {
    if (id === user.sub) throw new BadRequestException('Nemôžete zmazať sám seba.');
    const target = await this.findMemberOr404(id); // garantuje role === ORGANIZER_MEMBER (OWNER sa nedá zmazať)
    this.assertOwns(target, user);
    // RefreshToken + PasswordResetToken majú onDelete: Cascade
    await this.prisma.user.delete({ where: { id } });
    return { deleted: true };
  }
}
