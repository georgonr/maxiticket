import { apiFetch } from '@/lib/api';

export type OrderStatus =
  | 'PENDING'
  | 'PAID'
  | 'REFUND_REQUESTED'
  | 'REFUND_APPROVED'
  | 'REFUND_REJECTED'
  | 'REFUNDED'
  | 'CANCELLED'
  | 'FAILED';
export type OrderSort =
  | 'createdAt_desc'
  | 'createdAt_asc'
  | 'totalAmount_desc'
  | 'totalAmount_asc';

// Stav doručenia lístkov e-mailom (krok 48). 'unknown' = objednávka spred kroku 48
// (historicky nevieme), 'na' = ešte nezaplatená.
export type TicketsDelivery = 'delivered' | 'failed' | 'retrying' | 'unknown' | 'na';

export interface OrderListItem {
  orderId: string;
  orderNumber: string;
  status: OrderStatus;
  totalAmount: number;
  discountAmount: number;
  couponCode: string | null;
  paymentProvider: string | null;
  buyerName: string | null;
  buyerEmail: string;
  isGuest: boolean;
  organizerName: string | null;
  showTitles: string[];
  extraShows: number;
  ticketCount: number;
  createdAt: string;
  ticketsDelivery: TicketsDelivery;
  ticketsEmailError: string | null;
}

export interface OrderListResponse {
  items: OrderListItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface OrderDetailItem {
  showTitle: string | null;
  terminStartsAt: string | null;
  ticketTypeName: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface OrderDetailTicket {
  ticketId: string;
  codeSuffix: string;
  status: 'VALID' | 'USED' | 'CANCELLED' | 'REFUNDED' | string;
}

export interface OrderDetail {
  orderId: string;
  orderNumber: string;
  status: OrderStatus;
  currency: string;
  totalAmount: number;
  discountAmount: number;
  feeAmount: number;
  paymentProvider: string | null;
  paymentRef: string | null;
  paidAt: string | null;
  refundedAt: string | null;
  ticketsDelivery: TicketsDelivery;
  ticketsEmailedAt: string | null;
  ticketsEmailError: string | null;
  ticketsEmailAttempts: number;
  ekasaStatus: 'NONE' | 'PENDING' | 'REGISTERED' | 'OFFLINE' | 'FAILED';
  ekasaReceiptNumber: string | null;
  ekasaReceiptId: string | null;
  ekasaOkp: string | null;
  ekasaError: string | null;
  createdAt: string;
  organizerName: string | null;
  couponCode: string | null;
  buyerName: string | null;
  buyerEmail: string;
  buyerPhone: string | null;
  isGuest: boolean;
  userEmail: string | null;
  items: OrderDetailItem[];
  tickets: OrderDetailTicket[];
  refundRequests: OrderRefundRequest[];
}

export interface OrderRefundRequest {
  id: string;
  status: 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'REFUNDED';
  reason: string;
  reviewNote: string | null;
  refundAmount: number | null;
  requestedAt: string;
  reviewedAt: string | null;
  refundedAt: string | null;
}

export interface ListOrdersQuery {
  status?: OrderStatus | '';
  organizerId?: string;
  showId?: string;
  paymentProvider?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  sort?: OrderSort;
  limit?: number;
  offset?: number;
  undelivered?: '1';  // len PAID s nedoručenými lístkami (krok 48)
}

function toQuery(q: ListOrdersQuery): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) {
    if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
  }
  const s = params.toString();
  return s ? `?${s}` : '';
}

export const adminOrdersApi = {
  list: (query: ListOrdersQuery, token: string) =>
    apiFetch<OrderListResponse>('/v1/admin/orders' + toQuery(query), { token }),
  get: (id: string, token: string) =>
    apiFetch<OrderDetail>('/v1/admin/orders/' + id, { token }),
  // Manuálne odoslanie lístkov znova (krok 26/48). Vracia { orderId, message }.
  resend: (id: string, token: string) =>
    apiFetch<{ orderId: string; message: string }>('/v1/admin/orders/' + id + '/resend-tickets', {
      method: 'POST',
      token,
    }),
};

export const organizerOrdersApi = {
  list: (query: ListOrdersQuery, token: string) =>
    apiFetch<OrderListResponse>('/v1/organizer/orders' + toQuery(query), { token }),
  get: (id: string, token: string) =>
    apiFetch<OrderDetail>('/v1/organizer/orders/' + id, { token }),
};
