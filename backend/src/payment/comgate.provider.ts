import { Injectable, ServiceUnavailableException, Logger } from '@nestjs/common';
import { PaymentProvider, CreateCheckoutParams, CheckoutResult } from './payment.interface';

/**
 * Úloha 25: ComGate STUB – registrovaný, ale ešte nenakonfigurovaný (príprava na migráciu).
 * Kým sa nedoplní implementácia + kľúče, isConfigured() = false a checkout hodí 503.
 * SUPERADMIN nemôže túto bránu aktivovať (validácia v PaymentGatewayService).
 */
@Injectable()
export class ComGatePaymentProvider implements PaymentProvider {
  private readonly logger = new Logger(ComGatePaymentProvider.name);

  isConfigured(): boolean {
    return false; // TODO: COMGATE_MERCHANT_ID + COMGATE_SECRET v env
  }

  async createCheckoutSession(_params: CreateCheckoutParams): Promise<CheckoutResult> {
    this.logger.warn('ComGate checkout requested but provider is not configured.');
    throw new ServiceUnavailableException('Platobná brána ComGate ešte nie je nakonfigurovaná.');
  }

  async refund(): Promise<void> {
    throw new Error('ComGate refunds not implemented');
  }
}
