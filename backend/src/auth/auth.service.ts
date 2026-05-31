import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterOrganizerDto } from './dto/register.dto';
import { RegisterCustomerDto } from './dto/register-customer.dto';
import { LoginDto } from './dto/login.dto';
import { UserRole, TermsType } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomUUID, randomBytes, createHash } from 'crypto';
import { MailService } from '../mail/mail.service';

const BCRYPT_ROUNDS = 12;
const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL_DAYS = 7;

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private mail: MailService,
  ) {}

  async registerOrganizer(dto: RegisterOrganizerDto, ipAddress?: string, userAgent?: string) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already registered');

    const slugExists = await this.prisma.organizer.findUnique({ where: { slug: dto.organizerSlug } });
    if (slugExists) throw new ConflictException('Organizer slug already taken');

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    // Find active platform-wide organizer registration terms
    const activeTerms = await this.prisma.termsVersion.findFirst({
      where: { type: TermsType.ORGANIZER_REGISTRATION, isActive: true, organizerId: null },
      orderBy: { publishedAt: 'desc' },
    });

    const result = await this.prisma.$transaction(async (tx) => {
      const organizer = await tx.organizer.create({
        data: {
          name: dto.organizerName,
          slug: dto.organizerSlug,
          email: dto.email,
          phone: dto.phone,
        },
      });

      const user = await tx.user.create({
        data: {
          email: dto.email,
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: dto.phone,
          role: UserRole.ORGANIZER_OWNER,
          organizerId: organizer.id,
        },
      });

      if (activeTerms) {
        await tx.termsAcceptance.create({
          data: {
            termsVersionId: activeTerms.id,
            userId: user.id,
            ipAddress,
            userAgent,
          },
        });
      }

      return { organizer, user };
    });

    return this.issueTokenPair(result.user.id, result.user.email, result.user.role, result.user.organizerId);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || !user.passwordHash) throw new UnauthorizedException('Invalid credentials');
    if (!user.isActive) throw new UnauthorizedException('Account disabled');

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return this.issueTokenPair(user.id, user.email, user.role, user.organizerId);
  }

  async refresh(userId: string, rawRefreshToken: string) {
    const stored = await this.prisma.refreshToken.findUnique({ where: { token: rawRefreshToken } });

    if (!stored || stored.userId !== userId || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token invalid or expired');
    }

    // Rotate: revoke old, issue new
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return this.issueTokenPair(user.id, user.email, user.role, user.organizerId);
  }

  async registerCustomer(dto: RegisterCustomerDto, ipAddress?: string, userAgent?: string) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already registered');

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const activeTerms = await this.prisma.termsVersion.findFirst({
      where: { type: TermsType.BUYER_PURCHASE, isActive: true, organizerId: null },
      orderBy: { publishedAt: 'desc' },
    });

    const user = await this.prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          email: dto.email,
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: dto.phone,
          role: UserRole.CUSTOMER,
        },
      });
      if (activeTerms) {
        await tx.termsAcceptance.create({
          data: { termsVersionId: activeTerms.id, userId: u.id, ipAddress, userAgent },
        });
      }
      // Claim any prior guest/comp orders made with this email so they appear
      // in the new account's /account/tickets.
      await tx.order.updateMany({
        where: { buyerEmail: u.email, userId: null },
        data: { userId: u.id },
      });
      return u;
    });

    return this.issueTokenPair(user.id, user.email, user.role, null);
  }

  async logout(rawRefreshToken: string) {
    await this.prisma.refreshToken.updateMany({
      where: { token: rawRefreshToken, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    // Always return silently – do not reveal whether the email exists
    if (!user || !user.isActive || !user.passwordHash) return;

    // Invalidate any existing unused tokens for this user
    await this.prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    const rawToken = randomBytes(32).toString('hex'); // 64-char hex
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await this.prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    // Úloha 11: /reset-password is now top-level on the main domain for every role
    // (after reset the user logs in at /login and is role-redirected). Unified link.
    const frontendBase = this.config.get('EMAIL_BASE_URL') ?? 'https://ticketall.eu';
    const resetLink = `${frontendBase}/reset-password?token=${rawToken}`;

    await this.mail.sendPasswordReset({
      to: email,
      firstName: user.firstName ?? undefined,
      resetLink,
    }).catch((e) => console.error('Password reset email failed:', e));
  }

  async resetPassword(rawToken: string, newPassword: string): Promise<void> {
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const record = await this.prisma.passwordResetToken.findFirst({
      where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
    });
    if (!record) throw new BadRequestException('Token je neplatný alebo expirovaný');

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    await this.prisma.$transaction(async (tx) => {
      await tx.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      });
      await tx.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      });
      await tx.refreshToken.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });
  }

  private async issueTokenPair(
    userId: string,
    email: string,
    role: UserRole,
    organizerId: string | null,
  ) {
    const payload = { sub: userId, email, role, ...(organizerId && { organizerId }) };

    const accessToken = this.jwt.sign(payload, {
      secret: this.config.get('JWT_SECRET'),
      expiresIn: ACCESS_TOKEN_TTL,
    });

    const refreshToken = randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_TTL_DAYS);

    await this.prisma.refreshToken.create({
      data: { token: refreshToken, userId, expiresAt },
    });

    return { accessToken, refreshToken, expiresIn: 900 };
  }
}
