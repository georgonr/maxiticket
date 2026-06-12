import {
  Injectable,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from '../casl/casl-ability.factory';
import { CreateScannerDto } from './dto/create-scanner.dto';
import { UpdateScannerDto } from './dto/update-scanner.dto';

const BCRYPT_ROUNDS = 12;

const SCANNER_SELECT = {
  id: true,
  email: true,
  firstName: true,
  isActive: true,
  organizerId: true,
  lastLoginAt: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class ScannersService {
  constructor(private readonly prisma: PrismaService) {}

  private isSuperOrStaff(user: JwtPayload): boolean {
    return user.role === UserRole.SUPERADMIN || user.role === UserRole.STAFF;
  }

  /** Vyrieši cieľového organizera: owner = vlastný; super/staff = z parametra (povinné). */
  private resolveOrganizerId(user: JwtPayload, requested?: string): string {
    if (this.isSuperOrStaff(user)) {
      if (!requested) {
        throw new BadRequestException('organizerId je povinný pre SUPERADMIN/STAFF.');
      }
      return requested;
    }
    if (!user.organizerId) throw new ForbiddenException();
    if (requested && requested !== user.organizerId) throw new ForbiddenException();
    return user.organizerId;
  }

  /** Owner smie pracovať len so scannermi vlastného organizera; super/staff so všetkými. */
  private assertOwns(target: { organizerId: string | null }, user: JwtPayload) {
    if (this.isSuperOrStaff(user)) return;
    if (target.organizerId !== user.organizerId) throw new ForbiddenException();
  }

  async create(dto: CreateScannerDto, user: JwtPayload) {
    const organizerId = this.resolveOrganizerId(user, dto.organizerId);

    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('E-mail je už zaregistrovaný.');

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const scanner = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        firstName: dto.name?.trim() || null,
        role: UserRole.SCANNER,
        organizerId,
        isActive: true,
        emailVerified: true,
      },
      select: SCANNER_SELECT,
    });
    return scanner;
  }

  async list(user: JwtPayload, organizerId?: string) {
    const where: Prisma.UserWhereInput = { role: UserRole.SCANNER };
    if (this.isSuperOrStaff(user)) {
      if (organizerId) where.organizerId = organizerId;
    } else {
      if (!user.organizerId) throw new ForbiddenException();
      where.organizerId = user.organizerId;
    }
    return this.prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: SCANNER_SELECT,
    });
  }

  private async findScannerOr404(id: string) {
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target || target.role !== UserRole.SCANNER) {
      throw new NotFoundException('Scanner účet neexistuje.');
    }
    return target;
  }

  async setActive(id: string, dto: UpdateScannerDto, user: JwtPayload) {
    const target = await this.findScannerOr404(id);
    this.assertOwns(target, user);
    return this.prisma.user.update({
      where: { id },
      data: { isActive: dto.isActive },
      select: SCANNER_SELECT,
    });
  }

  async remove(id: string, user: JwtPayload) {
    const target = await this.findScannerOr404(id);
    this.assertOwns(target, user);
    // RefreshToken má onDelete: Cascade; ScanLog.scannedById je voliteľný → SetNull
    // (skenovacia história ostane zachovaná, len bez väzby na zmazaného scannera).
    await this.prisma.user.delete({ where: { id } });
    return { deleted: true };
  }
}
