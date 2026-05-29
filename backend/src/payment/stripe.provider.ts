import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PaymentProvider, CreateCheckoutParams, CheckoutResult } from './payment.interface';

@Injectable()
export class StripePaymentProvider implements PaymentProvider {
  private readonly logger = new Logger(StripePaymentProvider.name);
  readonly client: Stripe;
  readonly webhookSecret: string;

  constructor(private config: ConfigService) {
    const secretKey = config.get<string>('STRIPE_SECRET_KEY') ?? '';
    this.webhookSecret = config.get<string>('STRIPE_WEBHOOK_SECRET') ?? '';
    if (!secretKey) {
      this.logger.warn('STRIPE_SECRET_KEY is not set – Stripe payments disabled');
    }
    // Use placeholder key when none configured; prevents SDK init error in mock mode
    this.client = new Stripe(secretKey || 'sk_test_placeholder', { apiVersion: '2024-06-20' as any });
  }

  async createCheckoutSession(params: CreateCheckoutParams): Promise<CheckoutResult> {
    const expiresAt = Math.floor(Date.now() / 1000) + 30 * 60; // 30 min

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
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      expires_at: expiresAt,
    });

    return {
      checkoutUrl: session.url!,
      externalId: session.id,
      synchronous: false,
    };
  }

  async refund(_paymentRef: string, _amount: number, _currency: string): Promise<void> {
    throw new Error('Refunds not yet implemented');
  }
}
