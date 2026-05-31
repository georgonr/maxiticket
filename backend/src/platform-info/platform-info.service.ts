import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdatePlatformInfoDto } from './dto/update-platform-info.dto';
import { Decimal } from '@prisma/client/runtime/library';

export interface EffectiveVatInput {
  vatPayer: boolean;
  vatRate?: Decimal | null;
  addressCountry?: string | null;
}

@Injectable()
export class PlatformInfoService {
  constructor(private prisma: PrismaService) {}

  async getCurrent() {
    const existing = await this.prisma.platformInfo.findFirst();
    if (existing) return existing;
    return this.prisma.platformInfo.create({
      data: { legalName: 'TicketAll s.r.o.' },
    });
  }

  async updateCurrent(dto: UpdatePlatformInfoDto) {
    const existing = await this.getCurrent();
    return this.prisma.platformInfo.update({
      where: { id: existing.id },
      data: dto as any,
    });
  }

  async getEffectiveVatRate(organizer: EffectiveVatInput): Promise<number> {
    if (!organizer.vatPayer) return 0;
    if (organizer.vatRate != null) return Number(organizer.vatRate);
    const platform = await this.getCurrent();
    const country = organizer.addressCountry ?? 'SK';
    if (country === 'CZ') return Number(platform.defaultVatRateCz);
    if (country === 'SK') return Number(platform.defaultVatRateSk);
    return 0;
  }
}
