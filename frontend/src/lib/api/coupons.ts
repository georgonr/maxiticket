import { apiFetch } from '@/lib/api';

export interface ValidateCouponItem {
  ticketTypeId: string;
  quantity: number;
}

export interface ValidateCouponPayload {
  code: string;
  subtotal: number;
  items: ValidateCouponItem[];
  userId?: string;
}

export type CouponValidationResult =
  | {
      valid: true;
      couponId: string;
      type: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_TICKET';
      scope: 'GLOBAL' | 'ORGANIZER' | 'SHOW' | 'TICKET_TYPE';
      discount: number;
      finalAmount: number;
    }
  | { valid: false; reason: string };

/** PUBLIC – validácia kupónu pri checkout (žiadny auth header). */
export const couponsApi = {
  validate: (payload: ValidateCouponPayload) =>
    apiFetch<CouponValidationResult>('/v1/coupons/validate', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};
