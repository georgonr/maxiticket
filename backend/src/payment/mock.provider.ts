import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PaymentProvider, CreateCheckoutParams, CheckoutResult } from './payment.interface';

@Injectable()
export class MockPaymentProvider implements PaymentProvider {
  async createCheckoutSession(params: CreateCheckoutParams): Promise<CheckoutResult> {
    return {
      checkoutUrl: params.successUrl,
      externalId: `mock_${randomUUID()}`,
      synchronous: true,
    };
  }

  async refund(): Promise<void> {
    throw new Error('Refunds not implemented for mock provider');
  }
}
