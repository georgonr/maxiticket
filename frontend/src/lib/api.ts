import { getValidToken, clearAccessToken } from './auth';

export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.ticketall.eu';

type FetchOptions = RequestInit & { token?: string; _retried?: boolean };

export async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { token, headers, body, _retried, ...rest } = options;
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  const hasBody = body !== undefined && body !== null;
  const res = await fetch(`${API_BASE}${path}`, {
    ...rest,
    body,
    headers: {
      // Only set Content-Type: application/json when there is actually a body to send.
      // Sending it with an empty body causes Fastify to reject the request (FST_ERR_CTP_EMPTY_JSON_BODY).
      ...(!isFormData && hasBody ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });

  if (!res.ok) {
    // 401 na autentizovanom requeste → jednorazový retry s čerstvým tokenom.
    // getValidToken() zdieľa _refreshPromise, takže N paralelných requestov spustí len 1 refresh.
    // Body je string/FormData (nie skonzumovaný stream), takže zopakovanie requestu je bezpečné.
    if (res.status === 401 && token && !_retried) {
      clearAccessToken();
      const fresh = await getValidToken();
      if (fresh) {
        return apiFetch<T>(path, { ...options, token: fresh, _retried: true });
      }
      // Refresh zlyhal → propaguj 401 (stránky spravia redirect na login).
    }

    const errBody = await res.json().catch(() => ({}));
    const message =
      typeof errBody?.message === 'string'
        ? errBody.message
        : Array.isArray(errBody?.message)
          ? errBody.message.join(', ')
          : `HTTP ${res.status}`;
    throw new ApiError(res.status, message, errBody);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

// Auth-specific helpers
export const authApi = {
  register: (body: RegisterOrganizerPayload) =>
    apiFetch<TokenPair>('/v1/auth/register', { method: 'POST', body: JSON.stringify(body) }),

  login: (email: string, password: string) =>
    apiFetch<TokenPair>('/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  refresh: (refreshToken: string) =>
    apiFetch<TokenPair>('/v1/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    }),

  logout: (token: string, refreshToken: string) =>
    apiFetch<void>('/v1/auth/logout', {
      method: 'POST',
      token,
      body: JSON.stringify({ refreshToken }),
    }),

  registerCustomer: (body: RegisterCustomerPayload) =>
    apiFetch<TokenPair>('/v1/auth/register-customer', { method: 'POST', body: JSON.stringify(body) }),
};

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface RegisterOrganizerPayload {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  organizerName: string;
  organizerSlug: string;
  phone?: string;
  acceptTerms: true;
}

// Shows
export const showsApi = {
  list: (token: string) => apiFetch<Show[]>('/v1/shows', { token }),
  get: (id: string, token: string) => apiFetch<ShowDetail>('/v1/shows/' + id, { token }),
  create: (body: CreateShowBody, token: string) => apiFetch<Show>('/v1/shows', { method: 'POST', body: JSON.stringify(body), token }),
  update: (id: string, body: Partial<CreateShowBody>, token: string) => apiFetch<Show>('/v1/shows/' + id, { method: 'PATCH', body: JSON.stringify(body), token }),
  updateStatus: (id: string, status: string, token: string) => apiFetch<Show>('/v1/shows/' + id + '/status', { method: 'PATCH', body: JSON.stringify({ status }), token }),
  delete: (id: string, token: string) => apiFetch<void>('/v1/shows/' + id, { method: 'DELETE', token }),
};

export const showImagesApi = {
  list: (showId: string, token: string) => apiFetch<ShowImage[]>(`/v1/shows/${showId}/images`, { token }),
  upload: (showId: string, files: File[], token: string) => {
    const fd = new FormData();
    files.forEach((f) => fd.append('files', f));
    return apiFetch<ShowImage[]>(`/v1/shows/${showId}/images`, { method: 'POST', body: fd, token });
  },
  setCover: (showId: string, imageId: string, token: string) =>
    apiFetch<ShowImage>(`/v1/shows/${showId}/images/${imageId}/cover`, { method: 'PATCH', token }),
  delete: (showId: string, imageId: string, token: string) =>
    apiFetch<void>(`/v1/shows/${showId}/images/${imageId}`, { method: 'DELETE', token }),
};

export const venuesApi = {
  list: (token: string, query: VenueListQuery = {}) => {
    const p = new URLSearchParams();
    if (query.search) p.set('search', query.search);
    if (query.isActive) p.set('isActive', 'true');
    if (query.organizerId) p.set('organizerId', query.organizerId);
    const qs = p.toString();
    return apiFetch<Venue[]>('/v1/venues' + (qs ? `?${qs}` : ''), { token });
  },
  get: (id: string, token: string) => apiFetch<Venue>('/v1/venues/' + id, { token }),
  create: (
    body: CreateVenueBody,
    token: string,
    opts: { global?: boolean; organizerId?: string } = {},
  ) => {
    const p = new URLSearchParams();
    if (opts.global) p.set('global', 'true');
    if (opts.organizerId) p.set('organizerId', opts.organizerId);
    const qs = p.toString();
    return apiFetch<Venue>('/v1/venues' + (qs ? `?${qs}` : ''), {
      method: 'POST',
      body: JSON.stringify(body),
      token,
    });
  },
  update: (id: string, body: Partial<CreateVenueBody> & { isActive?: boolean }, token: string) =>
    apiFetch<Venue>('/v1/venues/' + id, { method: 'PATCH', body: JSON.stringify(body), token }),
  remove: (id: string, token: string) =>
    apiFetch<{ deleted: boolean; deactivated: boolean }>('/v1/venues/' + id, {
      method: 'DELETE',
      token,
    }),
  // Úloha 24: zdieľanie miesta (SUPERADMIN/STAFF)
  getAccess: (id: string, token: string) =>
    apiFetch<{ venueId: string; organizerIds: string[] }>('/v1/venues/' + id + '/access', { token }),
  setAccess: (id: string, organizerIds: string[], token: string) =>
    apiFetch<{ venueId: string; organizerIds: string[] }>('/v1/venues/' + id + '/access', {
      method: 'PUT',
      body: JSON.stringify({ organizerIds }),
      token,
    }),
};

// Úloha 24: zoznam organizátorov pre multi-select zdieľania (SUPERADMIN).
export interface OrganizerLite {
  id: string;
  name: string;
  slug: string;
}
export const organizersApi = {
  list: (token: string) => apiFetch<OrganizerLite[]>('/v1/organizers', { token }),
};

// Úloha 26: CSV export platieb na refund (ADMIN + ORGANIZER vlastník)
export const refundExportApi = {
  download: async (eventId: string, token: string, occurrenceId?: string): Promise<Blob> => {
    const qs = occurrenceId ? `?occurrenceId=${encodeURIComponent(occurrenceId)}` : '';
    const res = await fetch(`${API_BASE}/v1/events/${eventId}/refund-export${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Export zlyhal (HTTP ${res.status})`);
    return res.blob();
  },
};

// Krok 27: zrušenie jedného termínu (occurrence)
export interface CancelOccurrenceResult {
  occurrenceId: string;
  status: string;
  orderCount: number;
  emailsSent: number;
}
export interface CancelEventResult {
  eventId: string;
  status: string;
  cancelledCount: number;
  refundedCount: number;
  totalRefunded: number;
  emailsSent: number;
}
export const eventOpsApi = {
  cancelOccurrence: (eventId: string, occurrenceId: string, token: string) =>
    apiFetch<CancelOccurrenceResult>(`/v1/events/${eventId}/occurrences/${occurrenceId}/cancel`, {
      method: 'POST',
      token,
    }),
  // Event-level zrušenie (SUPERADMIN) – hromadný refund + notifikácie.
  cancelEvent: (eventId: string, reason: string | undefined, token: string) =>
    apiFetch<CancelEventResult>(`/v1/events/${eventId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason: reason ?? undefined }),
      token,
    }),
  // Organizer žiada o zrušenie (SUPERADMIN vykoná neskôr).
  requestCancel: (eventId: string, token: string) =>
    apiFetch<{ eventId: string; cancelRequested: boolean }>(`/v1/events/${eventId}/request-cancel`, {
      method: 'POST',
      token,
    }),
  // Kópia podujatia do nového draftu.
  copyEvent: (eventId: string, token: string) =>
    apiFetch<Show>(`/v1/events/${eventId}/copy`, { method: 'POST', token }),
};

// Úloha 25: platobné brány (SUPERADMIN/STAFF)
export type PaymentGatewayId = 'STRIPE_SANDBOX' | 'STRIPE_LIVE' | 'COMGATE_TEST' | 'COMGATE_LIVE';
export interface PaymentGatewayStatus {
  gateway: PaymentGatewayId;
  active: boolean;
  configured: boolean;
}
export const paymentGatewaysApi = {
  list: (token: string) =>
    apiFetch<{ gateways: PaymentGatewayStatus[] }>('/v1/admin/payment-gateways', { token }),
  setActive: (gateway: PaymentGatewayId, token: string) =>
    apiFetch<{ gateways: PaymentGatewayStatus[] }>('/v1/admin/payment-gateways/active', {
      method: 'PUT',
      body: JSON.stringify({ gateway }),
      token,
    }),
};

export const terminsApi = {
  list: (showId: string, token: string) => apiFetch<Termin[]>('/v1/shows/' + showId + '/termins', { token }),
  get: (showId: string, id: string, token: string) => apiFetch<Termin>('/v1/shows/' + showId + '/termins/' + id, { token }),
  create: (showId: string, body: CreateTerminBody, token: string) => apiFetch<Termin>('/v1/shows/' + showId + '/termins', { method: 'POST', body: JSON.stringify(body), token }),
  update: (showId: string, id: string, body: Partial<CreateTerminBody>, token: string) => apiFetch<Termin>('/v1/shows/' + showId + '/termins/' + id, { method: 'PATCH', body: JSON.stringify(body), token }),
  delete: (showId: string, id: string, token: string) => apiFetch<void>('/v1/shows/' + showId + '/termins/' + id, { method: 'DELETE', token }),
  // Úloha 22/3a: sekcie termínu (SEATMAP režim)
  listSections: (showId: string, id: string, token: string) => apiFetch<TerminSectionsResponse>('/v1/shows/' + showId + '/termins/' + id + '/sections', { token }),
  setSectionPrice: (showId: string, id: string, terminSectionId: string, body: { price: number; currency?: string }, token: string) => apiFetch<TerminSectionRow>('/v1/shows/' + showId + '/termins/' + id + '/sections/' + terminSectionId, { method: 'PATCH', body: JSON.stringify(body), token }),
};

export interface TerminSectionRow {
  id: string;
  sectionId: string;
  name: string;
  sectionMode: 'SECTIONED' | 'SEATED';
  capacity: number | null;
  price: number;
  currency: string;
  sold: number;
  remaining: number | null;
  sellable: boolean;
}

export interface TerminSectionsResponse {
  mode: 'GENERAL' | 'SEATMAP';
  seatMapId: string | null;
  sections: TerminSectionRow[];
}

export const ticketTypesApi = {
  list: (terminId: string, token: string) => apiFetch<TicketType[]>('/v1/termins/' + terminId + '/ticket-types', { token }),
  create: (terminId: string, body: CreateTicketTypeBody, token: string) => apiFetch<TicketType>('/v1/termins/' + terminId + '/ticket-types', { method: 'POST', body: JSON.stringify(body), token }),
  update: (terminId: string, id: string, body: Partial<CreateTicketTypeBody>, token: string) => apiFetch<TicketType>('/v1/termins/' + terminId + '/ticket-types/' + id, { method: 'PATCH', body: JSON.stringify(body), token }),
  delete: (terminId: string, id: string, token: string) => apiFetch<void>('/v1/termins/' + terminId + '/ticket-types/' + id, { method: 'DELETE', token }),
};

// Domain types
export interface ShowImage {
  id: string;
  url: string;
  thumbUrl: string;
  squareUrl: string;
  isCover: boolean;
  sortOrder: number;
}

export interface Show {
  id: string;
  name: string;
  slug: string;
  description?: string;
  category?: string;
  seoTitle?: string;
  seoDescription?: string;
  status: string;
  organizerId: string;
  images?: ShowImage[];
  createdAt: string;
  isPast?: boolean; // posledný termín skončil >5 h → skryté z verejného zoznamu
  nextTerminAt?: string | null; // najbližší budúci termín (fallback posledný minulý); null = bez termínu

  // Event-level zrušenie / žiadosť o zrušenie
  cancelledAt?: string | null;
  cancellationReason?: string | null;
  cancelRequestedAt?: string | null;
}

export interface ShowDetail extends Show {
  images: ShowImage[];
  termins: Termin[];
}

export interface Venue {
  id: string;
  name: string;
  city?: string;
  street?: string;
  postalCode?: string;
  country?: string;
  capacity?: number;
  notes?: string;
  organizerId?: string | null;
  isActive?: boolean;
}

export interface VenueListQuery {
  search?: string;
  isActive?: boolean;
  organizerId?: string;
}

export interface Termin {
  id: string;
  showId: string;
  venueId: string;
  venue?: Venue;
  startsAt: string;
  endsAt?: string;
  timezone: string;
  status: string;
  visible: boolean;
  capacity?: number;
  ticketTypes?: TicketType[];
  mode?: 'GENERAL' | 'SEATMAP';
  seatMapId?: string | null;
}

export interface TicketType {
  id: string;
  terminId: string;
  name: string;
  price: string;
  currency: string;
  totalQuantity?: number;
  maxPerOrder: number;
  saleStartsAt?: string;
  saleEndsAt?: string;
  isActive: boolean;
  qrPaymentEnabled: boolean;
}

export interface CreateShowBody {
  name: string;
  slug: string;
  description?: string;
  category?: string;
  seoTitle?: string;
  seoDescription?: string;
  status?: string;
}

export interface CreateVenueBody {
  name: string;
  city?: string;
  street?: string;
  postalCode?: string;
  country?: string;
  capacity?: number;
  notes?: string;
}

export interface CreateTerminBody {
  venueId: string;
  startsAt: string;
  endsAt?: string;
  doorsOpenAt?: string;
  timezone?: string;
  capacity?: number;
  status?: string;
  visible?: boolean;
  notes?: string;
  mode?: 'GENERAL' | 'SEATMAP';
  seatMapId?: string | null;
}

export interface CreateTicketTypeBody {
  name: string;
  price: number;
  currency?: string;
  totalQuantity?: number;
  maxPerOrder?: number;
  saleStartsAt?: string;
  saleEndsAt?: string;
  isActive?: boolean;
  qrPaymentEnabled?: boolean;
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface PublicTermin {
  id: string;
  startsAt: string;
  timezone: string;
  status: string;
  city: string | null;
  venueName: string | null;
  minPrice: number | null;
  currency: string;
}

export interface PublicShow {
  id: string;
  slug: string;
  name: string;
  category: string | null;
  coverUrl: string | null;
  termins: PublicTermin[];
}

export interface PublicTicketType {
  id: string;
  terminId: string;
  name: string;
  description?: string;
  price: number;
  currency: string;
  totalQuantity: number | null;
  maxPerOrder: number;
  saleStartsAt?: string;
  saleEndsAt?: string;
  isActive: boolean;
  available: number | null;
  qrPaymentEnabled?: boolean;
}

export interface PublicSection {
  id: string;
  name: string;
  sectionMode: 'SECTIONED' | 'SEATED';
  price: number;
  currency: string;
  available: number | null;
  sellable: boolean;
}

export interface PublicTerminDetail {
  id: string;
  startsAt: string;
  endsAt?: string;
  doorsOpenAt?: string;
  timezone: string;
  status: string;
  venue: { id: string; name: string; city?: string; street?: string };
  ticketTypes: PublicTicketType[];
  mode: 'GENERAL' | 'SEATMAP';
  sections: PublicSection[];
}

export interface PublicShowDetail {
  id: string;
  slug: string;
  name: string;
  description?: string;
  category?: string;
  status: string; // EventStatus – 'CANCELLED' → banner o zrušení
  images: ShowImage[];
  termins: PublicTerminDetail[];
}

export type HeroSlideType =
  | { type: 'banner'; id: string; title: string; subtitle: string | null; imageUrl: string; ctaLabel: string | null; ctaUrl: string | null }
  | { type: 'show'; id: string; slug: string; name: string; imageUrl: string | null; startsAt: string; timezone: string; city: string | null; venueName: string | null; ctaUrl: string };

export const publicApi = {
  listShows: (params?: { category?: string; date?: string; city?: string; q?: string }) => {
    const q = new URLSearchParams();
    if (params?.category) q.set('category', params.category);
    if (params?.date) q.set('date', params.date);
    if (params?.city) q.set('city', params.city);
    if (params?.q) q.set('q', params.q);
    const qs = q.toString();
    return apiFetch<PublicShow[]>(`/v1/public/shows${qs ? '?' + qs : ''}`);
  },
  getShow: (slug: string) => apiFetch<PublicShowDetail>(`/v1/public/shows/${slug}`),
  // Krok 30: pool vybraných podujatí pre homepage
  featuredShows: () => apiFetch<PublicShow[]>('/v1/public/featured-shows'),
  getFilters: () => apiFetch<{ categories: string[]; cities: string[] }>('/v1/public/filters'),
  getHero: () => apiFetch<HeroSlideType[]>('/v1/public/hero'),
  // Úloha 22/3b: sedadlá SEATED sekcií termínu so statusom (pre seat-picker)
  getTerminSeats: (terminId: string) => apiFetch<PublicTerminSeats>(`/v1/public/termins/${terminId}/seats`),
  // Krok 2/2: zákaznícky poplatok za spracovanie pre danú sumu (display v checkoute; vracia LEN sumu).
  feeQuote: (terminId: string, amount: number) =>
    apiFetch<{ feeAmount: number }>(`/v1/public/checkout/fee-quote?terminId=${terminId}&amount=${amount}`),

  // QR rýchly nákup (scan-to-buy)
  qrInfo: (ticketTypeId: string) => apiFetch<QrTicketInfo>(`/v1/public/qr/${ticketTypeId}`),
  qrCheckout: (body: { ticketTypeId: string; quantity: number; email: string; locale?: string }) =>
    apiFetch<{ url: string }>('/v1/public/qr-checkout', { method: 'POST', body: JSON.stringify(body) }),

  // Guest ticket view na success stránke (1h token z order pollingu). 410 po expirácii.
  guestTicketsByToken: (token: string) =>
    apiFetch<GuestTickets>(`/v1/public/orders/by-token/${encodeURIComponent(token)}`),
  guestTicketPdf: async (token: string, ticketId: string): Promise<Blob> => {
    const res = await fetch(
      `${API_BASE}/v1/public/orders/by-token/${encodeURIComponent(token)}/tickets/${ticketId}/pdf`,
    );
    if (!res.ok) throw new ApiError(res.status, `PDF download failed (HTTP ${res.status})`);
    return res.blob();
  },
};

export interface GuestTicket {
  id: string;
  typeName: string;
  qrToken: string;
}
export interface GuestTickets {
  orderNumber: string;
  showName: string;
  startsAt: string;
  timezone: string;
  venueName: string;
  venueCity: string | null;
  tickets: GuestTicket[];
}

export type QrReason = 'OK' | 'NOT_GA' | 'QR_DISABLED' | 'INACTIVE' | 'NOT_ON_SALE' | 'PAST' | 'SOLD_OUT' | 'SALE_WINDOW';

export interface QrTicketInfo {
  ticketTypeId: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  qrPaymentEnabled: boolean;
  available: number | null;
  maxQuantity: number;
  purchasable: boolean;
  reason: QrReason;
  show: { name: string; slug: string; imageUrl: string | null; organizerName: string | null };
  termin: { startsAt: string; endsAt: string | null; venueName: string | null; venueCity: string | null };
}

// ── Public seat picker (úloha 22/3b) ───────────────────────────────────────────
export interface PublicSeat {
  id: string;
  label: string;
  isAccessible: boolean;
  taken: boolean;
}
export interface PublicSeatRow {
  id: string;
  label: string;
  seats: PublicSeat[];
}
export interface PublicSeatSection {
  id: string; // terminSectionId
  sectionId: string;
  name: string;
  color: string | null;
  price: number;
  currency: string;
  rows: PublicSeatRow[];
}
export interface PublicTerminSeats {
  terminId: string;
  sections: PublicSeatSection[];
}

// ── Customer auth ─────────────────────────────────────────────────────────────

export interface RegisterCustomerPayload {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  acceptTerms: true;
}

// ── Orders ────────────────────────────────────────────────────────────────────

export interface CreateOrderPayload {
  terminId: string;
  // GENERAL: ticketTypeId+quantity. SECTIONED: terminSectionId+quantity. SEATED: terminSectionId+seatIds.
  items: { ticketTypeId?: string; terminSectionId?: string; quantity?: number; seatIds?: string[] }[];
  acceptTerms: true;
  // Guest checkout (required ak nie je prihlásený)
  buyerEmail?: string;
  buyerName?: string;
  buyerPhone?: string;
  // Krok 31e1: jazyk kupujúceho → Order.locale (lokalizované e-maily)
  locale?: 'sk' | 'en' | 'cs';
}

export interface OrderItem {
  id: string;
  ticketTypeId: string;
  terminId: string;
  quantity: number;
  unitPrice: number;
  currency: string;
  priceSnapshot: { name: string; price: number; currency: string; showName: string; startsAt: string };
}

export interface Order {
  id: string;
  orderNumber: string;
  status: string;
  totalAmount: number;
  currency: string;
  buyerEmail: string;
  buyerName?: string;
  paidAt?: string;
  items: OrderItem[];
  tickets?: { id: string; status: string; qrToken: string }[];
  // Po PAID: bezstavový 1h token pre guest zobrazenie/stiahnutie lístkov na success stránke.
  guestTicketToken?: string;
}

export const ordersApi = {
  // token voliteľný – guest checkout (OptionalJwtAuthGuard na backende)
  create: (body: CreateOrderPayload, token?: string) =>
    apiFetch<Order>('/v1/orders', { method: 'POST', body: JSON.stringify(body), token }),
  get: (id: string, token?: string) =>
    apiFetch<Order>('/v1/orders/' + id, { token }),
  /** Initiate payment – returns { url } to redirect to (Stripe or success page for mock). */
  checkout: (id: string, token?: string, couponCode?: string) =>
    apiFetch<{ url: string }>('/v1/orders/' + id + '/checkout', {
      method: 'POST',
      token,
      body: couponCode ? JSON.stringify({ couponCode }) : undefined,
    }),
  /** Dev-only mock payment fallback. */
  pay: (id: string, token: string) =>
    apiFetch<Order>('/v1/orders/' + id + '/pay', { method: 'POST', token }),
};

// ── My tickets ────────────────────────────────────────────────────────────────

export interface MyTicket {
  id: string;
  status: string;
  qrToken: string;
  createdAt: string;
  ticketType: { name: string; price: number; currency: string };
  order: { orderNumber: string };
  termin: {
    startsAt: string;
    timezone: string;
    doorsOpenAt?: string;
    show: { name: string; slug: string };
    venue: { name: string; city?: string; street?: string };
  };
}

export const myApi = {
  tickets: (token: string) => apiFetch<MyTicket[]>('/v1/my/tickets', { token }),
  ticket: (id: string, token: string) => apiFetch<MyTicket>('/v1/my/tickets/' + id, { token }),
};

// ── Hero Admin ────────────────────────────────────────────────────────────────

export interface HeroBanner {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string;
  ctaLabel: string | null;
  ctaUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  activeFrom: string | null;
  activeUntil: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminShow {
  id: string;
  name: string;
  slug: string;
  status: string;
  isPromoted: boolean;
  sliderImageId: string | null;
  category: string | null;
  images: { id: string; squareUrl: string }[];
  termins: { startsAt: string; status: string }[];
}

export type CreateHeroBannerBody = Omit<HeroBanner, 'id' | 'createdAt' | 'updatedAt'>;

export const heroAdminApi = {
  listBanners: (token: string) =>
    apiFetch<HeroBanner[]>('/v1/admin/hero-banners', { token }),
  createBanner: (body: Partial<CreateHeroBannerBody>, token: string) =>
    apiFetch<HeroBanner>('/v1/admin/hero-banners', { method: 'POST', body: JSON.stringify(body), token }),
  updateBanner: (id: string, body: Partial<CreateHeroBannerBody>, token: string) =>
    apiFetch<HeroBanner>('/v1/admin/hero-banners/' + id, { method: 'PATCH', body: JSON.stringify(body), token }),
  deleteBanner: (id: string, token: string) =>
    apiFetch<void>('/v1/admin/hero-banners/' + id, { method: 'DELETE', token }),
  uploadImage: (file: File, token: string) => {
    const fd = new FormData();
    fd.append('file', file);
    return apiFetch<{ imageUrl: string }>('/v1/admin/hero-banners/upload-image', { method: 'POST', body: fd, token });
  },
  listShows: (token: string) =>
    apiFetch<AdminShow[]>('/v1/admin/shows', { token }),
  promoteShow: (id: string, isPromoted: boolean, token: string) =>
    apiFetch<AdminShow>('/v1/admin/shows/' + id + '/promote', { method: 'PATCH', body: JSON.stringify({ isPromoted }), token }),
  setSliderImage: (id: string, sliderImageId: string | null, token: string) =>
    apiFetch<AdminShow>('/v1/admin/shows/' + id + '/promote', { method: 'PATCH', body: JSON.stringify({ isPromoted: true, sliderImageId }), token }),
  listShowImages: (showId: string, token: string) =>
    apiFetch<ShowImage[]>('/v1/shows/' + showId + '/images', { token }),
};

// ── Scanner ───────────────────────────────────────────────────────────────────

export interface ScanTermin {
  id: string;
  show: { id: string; name: string };
  startsAt: string;
  endsAt: string | null;
  venue: { name: string; city: string } | null;
  ticketCount: number;
  scannedCount: number;
}

export interface ScanValidateOk {
  ticketId: string;
  ticketCode?: string;
  showName: string;
  terminStartsAt: string;
  ticketTypeName: string;
  buyerName: string | null;
  seatSection: string | null;
  seatRow: string | null;
  seatNumber: string | null;
  message?: string;
}

export interface ScanError {
  code: 'NOT_FOUND' | 'INVALID_SIGNATURE' | 'WRONG_TERMIN' | 'WRONG_SHOW' | 'ALREADY_USED' | 'CANCELLED' | 'REFUNDED';
  message?: string;
  usedAt?: string | null;
  scannedBy?: string | null;
  correctTermin?: { id: string; startsAt: string; showName: string };
  correctShow?: { id: string; name: string; slug: string };
}

export const scanApi = {
  terminy: (token: string, showAll = false) =>
    apiFetch<ScanTermin[]>(`/v1/scan/terminy${showAll ? '?showAll=true' : ''}`, { token }),
  validate: (body: { qrToken: string; terminId: string }, token: string) =>
    apiFetch<ScanValidateOk>('/v1/scan/validate', { method: 'POST', body: JSON.stringify(body), token }),
};

// ── Organizer business údaje (KROK F) ──────────────────────────────────────────

export interface OrganizerBusiness {
  id: string;
  name: string;
  companyName: string | null;
  ico: string | null;
  icDph: string | null;
  vatPayer: boolean;
  vatRate: string | null;
  addressStreet: string | null;
  addressCity: string | null;
  addressZip: string | null;
  addressCountry: string | null;
  bankAccount: string | null;
}

export type UpdateOrganizerBusinessBody = Partial<{
  companyName: string;
  ico: string;
  icDph: string;
  vatPayer: boolean;
  vatRate: string;
  addressStreet: string;
  addressCity: string;
  addressZip: string;
  addressCountry: string;
  bankAccount: string;
}>;

export const organizerBusinessApi = {
  get: (token: string) =>
    apiFetch<OrganizerBusiness>('/v1/organizer/business', { token }),
  update: (body: UpdateOrganizerBusinessBody, token: string) =>
    apiFetch<OrganizerBusiness>('/v1/organizer/business', { method: 'PATCH', body: JSON.stringify(body), token }),
};

// ── Platform info (SUPERADMIN, KROK F) ──────────────────────────────────────────

export interface PlatformInfo {
  id: string;
  legalName: string;
  ico: string | null;
  icDph: string | null;
  addressStreet: string | null;
  addressCity: string | null;
  addressZip: string | null;
  addressCountry: string | null;
  defaultVatRateSk: string;
  defaultVatRateCz: string;
}

export type UpdatePlatformInfoBody = Partial<{
  legalName: string;
  ico: string;
  icDph: string;
  addressStreet: string;
  addressCity: string;
  addressZip: string;
  addressCountry: string;
  defaultVatRateSk: string;
  defaultVatRateCz: string;
}>;

export const platformInfoApi = {
  get: (token: string) =>
    apiFetch<PlatformInfo>('/v1/admin/platform-info', { token }),
  update: (body: UpdatePlatformInfoBody, token: string) =>
    apiFetch<PlatformInfo>('/v1/admin/platform-info', { method: 'PATCH', body: JSON.stringify(body), token }),
};
