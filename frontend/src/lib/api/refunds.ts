import { apiFetch } from '@/lib/api';

export type RefundStatus = 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'REFUNDED';

export interface RefundListItem {
  id: string;
  orderId: string;
  orderNumber: string;
  buyerName: string | null;
  buyerEmail: string;
  organizerName: string | null;
  orderTotal: number;
  currency: string;
  paymentProvider: string | null;
  orderStatus: string;
  reason: string;
  status: RefundStatus;
  reviewNote: string | null;
  refundAmount: number | null;
  requestedAt: string;
  reviewedAt: string | null;
  refundedAt: string | null;
}

export interface ReviewResult {
  id: string;
  status: RefundStatus;
  orderStatus: string;
  manualStripeNeeded?: boolean;
}

export interface MarkRefundedResult {
  id: string;
  status: RefundStatus;
  orderStatus: string;
  refundAmount: number;
  manualStripeNeeded: boolean;
  couponReturned: boolean;
}

const base = (admin: boolean) => (admin ? '/v1/admin/refunds' : '/v1/organizer/refunds');

export const refundsApi = {
  list: (admin: boolean, status: string, token: string) => {
    const qs = status ? `?status=${encodeURIComponent(status)}` : '';
    return apiFetch<RefundListItem[]>(base(admin) + qs, { token });
  },

  /** Schválenie / zamietnutie – vždy cez organizer endpoint (super/staff scoped tam). */
  review: (
    id: string,
    body: { action: 'approve' | 'reject'; reviewNote?: string; refundAmount?: number },
    token: string,
  ) =>
    apiFetch<ReviewResult>(`/v1/organizer/refunds/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
      token,
    }),

  markRefunded: (id: string, token: string) =>
    apiFetch<MarkRefundedResult>(`/v1/organizer/refunds/${id}/mark-refunded`, {
      method: 'PATCH',
      token,
    }),
};
