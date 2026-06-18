import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EkasaStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NineDigitEkasaProvider } from './ninedigit.provider';
import {
  EkasaItem, EkasaResult, EkasaRegisterInput, EkasaDeviceConfig,
} from './ekasa.interface';

const POS_SENTINEL_EMAIL = 'pos@ticketall.eu';

@Injectable()
export class EkasaService {
  private readonly logger = new Logger(EkasaService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private provider: NineDigitEkasaProvider,
  ) {}

  /** Globálny prepínač – fiškalizácia beží len keď EKASA_ENABLED=true. */
  isEnabled(): boolean {
    return this.config.get<string>('EKASA_ENABLED', 'false') === 'true';
  }

  private async getActiveDevice(organizerId: string) {
    return this.prisma.ekasaDevice.findFirst({
      where: { organizerId, active: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Fiškalizuj POS predaj. Nikdy nevyhadzuje – chyba sa uloží do Order.ekasa* a predaj prejde.
   * Ak je flag OFF alebo organizátor nemá aktívne zariadenie → ekasaStatus ostáva NONE.
   */
  async registerSaleForOrder(orderId: string): Promise<EkasaResult | null> {
    if (!this.isEnabled()) return null;
    try {
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: { items: true, organizer: true },
      });
      if (!order) return null;

      const device = await this.getActiveDevice(order.organizerId);
      if (!device) return null; // bez zariadenia = bez fiškalizácie (POS ako teraz)

      const org = order.organizer;
      const vatRate = org.ticketVatPercent;
      const seller = org.icDph
        ? { id: org.icDph, type: 'ICDPH' as const }
        : org.dic
          ? { id: org.dic, type: 'DIC' as const }
          : undefined;

      const items: EkasaItem[] = order.items.map((it) => ({
        type: 'positive',
        name: ((it.priceSnapshot as any)?.name as string) ?? 'Vstupenka',
        quantity: it.quantity,
        unitPrice: Number(it.unitPrice),
        vatRate,
      }));
      const discount = Number(order.discountAmount);
      if (discount > 0) {
        items.push({ type: 'discount', name: 'Zľava', quantity: 1, unitPrice: -discount, vatRate });
      }

      const paymentName = order.paymentProvider === 'pos_card' ? 'Platobná karta' : 'Hotovosť';
      const payments = [{ name: paymentName, amount: Number(order.totalAmount) }];

      const emailReal = order.buyerEmail && order.buyerEmail !== POS_SENTINEL_EMAIL && order.buyerEmail.includes('@');
      const input: EkasaRegisterInput = {
        externalId: order.id,
        items,
        payments,
        seller,
        ...(device.printMode === 'email' && emailReal ? { email: { to: order.buyerEmail } } : {}),
      };

      const cfg: EkasaDeviceConfig = {
        exposeUrl: device.exposeUrl,
        accessToken: device.accessToken,
        cashRegisterCode: device.cashRegisterCode,
        printMode: device.printMode,
      };

      await this.prisma.order.update({ where: { id: orderId }, data: { ekasaStatus: EkasaStatus.PENDING } });
      const result = await this.provider.registerSaleReceipt(input, cfg);
      await this.persist(orderId, result);
      this.logger.log(`eKasa order ${order.orderNumber}: ${result.status}${result.receiptNumber ? ` #${result.receiptNumber}` : ''}`);
      return result;
    } catch (e) {
      const msg = (e as Error).message;
      this.logger.error(`eKasa registerSaleForOrder ${orderId}: ${msg}`);
      await this.prisma.order
        .update({ where: { id: orderId }, data: { ekasaStatus: EkasaStatus.FAILED, ekasaError: msg } })
        .catch(() => undefined);
      return { status: 'FAILED', receiptId: null, okp: null, pkp: null, receiptNumber: null, error: msg };
    }
  }

  private async persist(orderId: string, r: EkasaResult) {
    const status = r.status === 'REGISTERED'
      ? EkasaStatus.REGISTERED
      : r.status === 'OFFLINE' ? EkasaStatus.OFFLINE : EkasaStatus.FAILED;
    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        ekasaStatus: status,
        ekasaReceiptId: r.receiptId,
        ekasaOkp: r.okp,
        ekasaPkp: r.pkp,
        ekasaReceiptNumber: r.receiptNumber,
        ekasaError: r.error,
        ekasaRegisteredAt: status === EkasaStatus.REGISTERED || status === EkasaStatus.OFFLINE ? new Date() : null,
      },
    });
  }

  // ─────────────────────── EkasaDevice CRUD (super-admin) ───────────────────────

  /** accessToken sa NEvracia v plnom znení – len indikátor že je nastavený. */
  private mask<T extends { accessToken: string }>(d: T) {
    const { accessToken, ...rest } = d;
    return { ...rest, hasAccessToken: !!accessToken };
  }

  async listDevices(organizerId: string) {
    const devices = await this.prisma.ekasaDevice.findMany({
      where: { organizerId },
      orderBy: { createdAt: 'asc' },
    });
    return devices.map((d) => this.mask(d));
  }

  async createDevice(dto: {
    organizerId: string; label: string; cashRegisterCode: string; exposeUrl: string;
    accessToken: string; printMode?: string; active?: boolean;
  }) {
    const org = await this.prisma.organizer.findUnique({ where: { id: dto.organizerId }, select: { id: true } });
    if (!org) throw new NotFoundException('Organizátor neexistuje.');
    const d = await this.prisma.ekasaDevice.create({
      data: {
        organizerId: dto.organizerId,
        label: dto.label,
        cashRegisterCode: dto.cashRegisterCode,
        exposeUrl: dto.exposeUrl,
        accessToken: dto.accessToken,
        printMode: dto.printMode ?? 'pos',
        active: dto.active ?? true,
      },
    });
    return this.mask(d);
  }

  async updateDevice(id: string, dto: {
    label?: string; cashRegisterCode?: string; exposeUrl?: string;
    accessToken?: string; printMode?: string; active?: boolean;
  }) {
    const exists = await this.prisma.ekasaDevice.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException('Zariadenie neexistuje.');
    const data: Prisma.EkasaDeviceUpdateInput = {
      ...(dto.label !== undefined ? { label: dto.label } : {}),
      ...(dto.cashRegisterCode !== undefined ? { cashRegisterCode: dto.cashRegisterCode } : {}),
      ...(dto.exposeUrl !== undefined ? { exposeUrl: dto.exposeUrl } : {}),
      // prázdny accessToken = nemeniť (nechať pôvodný)
      ...(dto.accessToken ? { accessToken: dto.accessToken } : {}),
      ...(dto.printMode !== undefined ? { printMode: dto.printMode } : {}),
      ...(dto.active !== undefined ? { active: dto.active } : {}),
    };
    const d = await this.prisma.ekasaDevice.update({ where: { id }, data });
    return this.mask(d);
  }

  async deleteDevice(id: string) {
    const exists = await this.prisma.ekasaDevice.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException('Zariadenie neexistuje.');
    await this.prisma.ekasaDevice.delete({ where: { id } });
    return { deleted: true };
  }
}
