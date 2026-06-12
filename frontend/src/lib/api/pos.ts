import { apiFetch } from '@/lib/api';

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

export const posApi = {
  termins: (token: string) =>
    apiFetch<PosTermin[]>('/v1/organizer/pos/termins', { token }),
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
