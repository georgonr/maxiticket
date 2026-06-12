import { apiFetch, API_BASE } from '@/lib/api';

export interface PosTicketType {
  ticketTypeId: string;
  name: string;
  price: number;
  currency: string;
  maxPerOrder: number;
  remaining: number | null; // null = neobmedzené
}

export interface PosTermin {
  terminId: string;
  showName: string;
  startsAt: string;
  venueName: string | null;
  venueCity: string | null;
  ticketTypes: PosTicketType[];
}

export interface PosOrderItem {
  ticketTypeId: string;
  quantity: number;
}

export interface PosOrderInput {
  terminId: string;
  items: PosOrderItem[];
  paymentMethod: 'cash' | 'card';
  buyerEmail?: string;
  buyerName?: string;
  couponCode?: string;
}

export interface PosOrderTicket {
  ticketId: string;
  ticketTypeName: string;
  qrToken: string;
}

export interface PosOrderResult {
  orderId: string;
  orderNumber: string;
  totalAmount: number;
  discountAmount: number;
  currency: string;
  emailSent: boolean;
  tickets: PosOrderTicket[];
}

export interface PosSummaryByTermin {
  showTitle: string | null;
  terminStartsAt: string | null;
  cash: number;
  card: number;
  tickets: number;
}

export interface PosSummary {
  periodFrom: string | null;
  now: string;
  cashTotal: number;
  cardTotal: number;
  total: number;
  orderCount: number;
  ticketCount: number;
  byTermin: PosSummaryByTermin[];
}

export interface PosClosure {
  id: string;
  periodFrom: string;
  periodTo: string;
  cashTotal: number;
  cardTotal: number;
  total: number;
  orderCount: number;
  ticketCount: number;
  note: string | null;
  closedByName: string | null;
  createdAt: string;
}

export interface PosClosuresResponse {
  items: PosClosure[];
  total: number;
  limit: number;
  offset: number;
}

export const posApi = {
  termins: (token: string) =>
    apiFetch<PosTermin[]>('/v1/organizer/pos/termins', { token }),

  summary: (token: string) =>
    apiFetch<PosSummary>('/v1/organizer/pos/summary', { token }),

  closures: (token: string, limit = 25, offset = 0) =>
    apiFetch<PosClosuresResponse>(
      `/v1/organizer/pos/closures?limit=${limit}&offset=${offset}`,
      { token },
    ),

  createClosure: (note: string | undefined, token: string) =>
    apiFetch<{ closure: PosClosure; orderNumbers: string[] }>('/v1/organizer/pos/closures', {
      method: 'POST',
      body: JSON.stringify({ note }),
      token,
    }),

  /** Stiahne PDF report uzávierky ako Blob (auth header). */
  closurePdf: async (id: string, token: string): Promise<Blob> => {
    const res = await fetch(`${API_BASE}/v1/organizer/pos/closures/${id}/pdf`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`PDF download zlyhalo (HTTP ${res.status})`);
    return res.blob();
  },
  createOrder: (input: PosOrderInput, token: string) =>
    apiFetch<PosOrderResult>('/v1/organizer/pos/orders', {
      method: 'POST',
      body: JSON.stringify(input),
      token,
    }),
  emailTickets: (orderId: string, email: string, token: string) =>
    apiFetch<{ sent: boolean; email: string }>(`/v1/organizer/pos/orders/${orderId}/email`, {
      method: 'POST',
      body: JSON.stringify({ email }),
      token,
    }),
};
