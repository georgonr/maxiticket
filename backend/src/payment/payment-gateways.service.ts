import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentGateway } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PAYMENT_PROVIDER, PaymentProvider } from './payment.interface';
import { StripeSandboxPaymentProvider } from './stripe-sandbox.provider';
import { ComGatePaymentProvider } from './comgate.provider';

const CONFIG_ID = 'default'; // singleton – fixné id, nikdy viac riadkov
const ALL_GATEWAYS: PaymentGateway[] = [
  PaymentGateway.STRIPE_SANDBOX,
  PaymentGateway.STRIPE_LIVE,
  PaymentGateway.COMGATE_TEST,
  PaymentGateway.COMGATE_LIVE,
];
const DEFAULT_GATEWAY = PaymentGateway.STRIPE_LIVE;

@Injectable()
export class PaymentGatewayService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    // Existujúci injektovaný provider (Stripe Live v prod / Mock v dev) – pre STRIPE_LIVE
    // ho vraciame NEZMENENÝ (ten istý instance) → default cesta je byte-identická s dneškom.
    @Inject(PAYMENT_PROVIDER) private defaultProvider: PaymentProvider,
    private stripeSandbox: StripeSandboxPaymentProvider,
    private comgate: ComGatePaymentProvider,
  ) {}

  /** Či má brána prítomné potrebné env kľúče (BEZ leaku hodnôt – len boolean). */
  isConfigured(gateway: PaymentGateway): boolean {
    switch (gateway) {
      case PaymentGateway.STRIPE_LIVE:
        return !!this.config.get<string>('STRIPE_SECRET_KEY');
      case PaymentGateway.STRIPE_SANDBOX:
        return this.stripeSandbox.isConfigured();
      case PaymentGateway.COMGATE_TEST:
      case PaymentGateway.COMGATE_LIVE:
        return this.comgate.isConfigured();
      default:
        return false;
    }
  }

  /** Aktívna brána zo singletonu; ak žiadny config → default STRIPE_LIVE. */
  async getActiveGateway(): Promise<PaymentGateway> {
    const cfg = await this.prisma.paymentGatewayConfig.findFirst();
    return cfg?.activeGateway ?? DEFAULT_GATEWAY;
  }

  /** Zoznam 4 brán so stavom pre admin UI. */
  async listGateways() {
    const active = await this.getActiveGateway();
    return {
      gateways: ALL_GATEWAYS.map((gateway) => ({
        gateway,
        active: gateway === active,
        configured: this.isConfigured(gateway),
      })),
    };
  }

  /** Nastav aktívnu bránu (singleton upsert s fixným id). Nenakonfigurovaná → 400. */
  async setActiveGateway(gateway: PaymentGateway, userId?: string) {
    if (!ALL_GATEWAYS.includes(gateway)) {
      throw new BadRequestException('Neznáma platobná brána.');
    }
    if (!this.isConfigured(gateway)) {
      throw new BadRequestException('Túto platobnú bránu nie je možné aktivovať – nie je nakonfigurovaná.');
    }
    await this.prisma.paymentGatewayConfig.upsert({
      where: { id: CONFIG_ID },
      create: { id: CONFIG_ID, activeGateway: gateway, updatedById: userId ?? null },
      update: { activeGateway: gateway, updatedById: userId ?? null },
    });
    return this.listGateways();
  }

  /**
   * Provider aktívnej brány – volá initiateCheckout namiesto priameho injektu.
   * STRIPE_LIVE → ten istý injektovaný provider ako dnes (žiadna zmena správania).
   */
  async getActiveProvider(): Promise<PaymentProvider> {
    const gateway = await this.getActiveGateway();
    switch (gateway) {
      case PaymentGateway.STRIPE_LIVE:
        return this.defaultProvider;
      case PaymentGateway.STRIPE_SANDBOX:
        return this.stripeSandbox;
      case PaymentGateway.COMGATE_TEST:
      case PaymentGateway.COMGATE_LIVE:
        return this.comgate;
      default:
        return this.defaultProvider;
    }
  }
}
