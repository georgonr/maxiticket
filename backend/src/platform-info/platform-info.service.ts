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
    // Prázdny riadok zámerne – firemné údaje vypĺňa superadmin v /admin/platform-info.
    // Predvyplnené meno by sa tichom dostalo na faktúry aj vstupenky.
    return this.prisma.platformInfo.create({ data: {} });
  }

  /**
   * Verejný podmnožinový pohľad pre /gdpr a /kontakt – identifikačné údaje
   * prevádzkovateľa, ktoré musia byť na webe zverejnené. Zámerne NEobsahuje
   * IBAN ani sadzby DPH: tie sú interné a na verejný web nepatria.
   */
  async getPublic() {
    const p = await this.getCurrent();
    return {
      legalName: p.legalName,
      ico: p.ico,
      dic: p.dic,
      icDph: p.icDph,
      addressStreet: p.addressStreet,
      addressCity: p.addressCity,
      addressZip: p.addressZip,
      addressCountry: p.addressCountry,
      registrationNote: p.registrationNote,
      contactEmail: p.contactEmail,
      contactPhone: p.contactPhone,
    };
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
