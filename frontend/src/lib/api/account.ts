import { apiFetch, API_BASE } from '@/lib/api';

export type OrderStatus =
  | 'PENDING'
  | 'PAID'
  | 'REFUND_REQUESTED'
  | 'REFUND_APPROVED'
  | 'REFUND_REJECTED'
  | 'REFUNDED'
  | 'CANCELLED'
  | 'FAILED';

export type RefundRequestStatus = 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'REFUNDED';

export interface RefundRequestItem {
  id: string;
  status: RefundRequestStatus;
  reason: string;
  reviewNote: string | null;
  refundAmount: number | null;
  requestedAt: string;
  reviewedAt: string | null;
  refundedAt: string | null;
}

export interface AccountOrderListItem {
  orderId: string;
  orderNumber: string;
  status: OrderStatus;
  totalAmount: number;
  discountAmount: number;
  couponCode: string | null;
  showTitles: string[];
  extraShows: number;
  ticketCount: number;
  createdAt: string;
}

export interface AccountOrdersResponse {
  items: AccountOrderListItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface AccountOrderDetailItem {
  showTitle: string | null;
  venueName: string | null;
  venueCity: string | null;
  terminStartsAt: string | null;
  ticketTypeName: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface AccountOrderTicket {
  ticketId: string;
  maskedCode: string;
  status: 'VALID' | 'USED' | 'CANCELLED' | 'REFUNDED' | string;
  qrToken: string;
}

export interface AccountOrderDetail {
  orderId: string;
  orderNumber: string;
  status: OrderStatus;
  currency: string;
  totalAmount: number;
  discountAmount: number;
  feeAmount: number;
  couponCode: string | null;
  paymentProvider: string | null;
  buyerName: string | null;
  buyerEmail: string;
  buyerPhone: string | null;
  createdAt: string;
  paidAt: string | null;
  items: AccountOrderDetailItem[];
  tickets: AccountOrderTicket[];
  canRequestRefund: boolean;
  refundRequests: RefundRequestItem[];
}

export interface AccountProfile {
  email: string;
  firstName: string | null;
  lastName: string | null;
  name: string | null;
  phone: string | null;
  role: string;
  marketingOptIn: boolean;
}

export const accountApi = {
  orders: (token: string, limit = 25, offset = 0) =>
    apiFetch<AccountOrdersResponse>(`/v1/account/orders?limit=${limit}&offset=${offset}`, { token }),

  order: (id: string, token: string) =>
    apiFetch<AccountOrderDetail>('/v1/account/orders/' + id, { token }),

  requestRefund: (id: string, reason: string, token: string) =>
    apiFetch<{ refundRequestId: string; status: string; orderStatus: string }>(
      `/v1/account/orders/${id}/refund-request`,
      { method: 'POST', body: JSON.stringify({ reason }), token },
    ),

  profile: (token: string) =>
    apiFetch<AccountProfile>('/v1/account/profile', { token }),

  updateNotifications: (marketingOptIn: boolean, token: string) =>
    apiFetch<{ marketingOptIn: boolean }>('/v1/account/notifications', {
      method: 'PATCH',
      body: JSON.stringify({ marketingOptIn }),
      token,
    }),

  /** Stiahne doklad PDF ako Blob (auth header). */
  receiptPdf: async (id: string, token: string): Promise<Blob> => {
    const res = await fetch(`${API_BASE}/v1/account/orders/${id}/receipt.pdf`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Stiahnutie dokladu zlyhalo (HTTP ${res.status})`);
    return res.blob();
  },
};
