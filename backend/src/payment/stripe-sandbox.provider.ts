import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PaymentProvider, CreateCheckoutParams, CheckoutResult } from './payment.interface';

/**
 * Úloha 25: Stripe SANDBOX provider – samostatný od live StripePaymentProvider (ten ostáva
 * nedotknutý kvôli peňažnej ceste). Číta STRIPE_SECRET_KEY_TEST; ak chýba → isConfigured()=false
 * a brána sa nedá aktivovať. Logika checkoutu je zhodná s live (test kľúč = sandbox prostredie).
 */
@Injectable()
export class StripeSandboxPaymentProvider implements PaymentProvider {
  private readonly logger = new Logger(StripeSandboxPaymentProvider.name);
  readonly client: Stripe;
  private readonly secretKey: string;

  constructor(private config: ConfigService) {
    this.secretKey = config.get<string>('STRIPE_SECRET_KEY_TEST') ?? '';
    this.client = new Stripe(this.secretKey || 'sk_test_placeholder', {
      apiVersion: '2024-06-20' as any,
    });
  }

  isConfigured(): boolean {
    return this.secretKey.length > 0;
  }

  async createCheckoutSession(params: CreateCheckoutParams): Promise<CheckoutResult> {
    const expiresAt = Math.floor(Date.now() / 1000) + 30 * 60;
    const session = await this.client.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: params.items.map((item) => ({
        price_data: {
          currency: params.currency.toLowerCase(),
          product_data: { name: item.name },
          unit_amount: Math.round(item.unitPrice * 100),
        },
        quantity: item.quantity,
      })),
      metadata: { orderId: params.orderId, orderNumber: params.orderNumber },
      ...(params.customerEmail ? { customer_email: params.customerEmail } : {}),
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      expires_at: expiresAt,
    });
    return { checkoutUrl: session.url!, externalId: session.id, synchronous: false };
  }

  async refund(): Promise<void> {
    throw new Error('Refunds not yet implemented');
  }
}
