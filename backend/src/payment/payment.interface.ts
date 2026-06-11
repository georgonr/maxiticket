export const PAYMENT_PROVIDER = Symbol('PaymentProvider');

export interface CreateCheckoutParams {
  orderId: string;
  orderNumber: string;
  currency: string;
  items: { name: string; unitPrice: number; quantity: number }[];
  customerEmail?: string;
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutResult {
  checkoutUrl: string;
  externalId: string;
  /** true = mock (order fulfilled synchronously); false = stripe (fulfilled via webhook) */
  synchronous: boolean;
}

export interface PaymentProvider {
  createCheckoutSession(params: CreateCheckoutParams): Promise<CheckoutResult>;
  /** Placeholder – not yet implemented; throw in both providers. */
  refund(paymentRef: string, amount: number, currency: string): Promise<void>;
}
