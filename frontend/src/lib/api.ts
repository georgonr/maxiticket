const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.maxiticket.africa';

type FetchOptions = RequestInit & { token?: string };

export async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { token, headers, body, ...rest } = options;
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  const res = await fetch(`${API_BASE}${path}`, {
    ...rest,
    body,
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message =
      typeof body?.message === 'string'
        ? body.message
        : Array.isArray(body?.message)
          ? body.message.join(', ')
          : `HTTP ${res.status}`;
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
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
  list: (token: string) => apiFetch<Venue[]>('/v1/venues', { token }),
  create: (body: CreateVenueBody, token: string) => apiFetch<Venue>('/v1/venues', { method: 'POST', body: JSON.stringify(body), token }),
};

export const terminsApi = {
  list: (showId: string, token: string) => apiFetch<Termin[]>('/v1/shows/' + showId + '/termins', { token }),
  create: (showId: string, body: CreateTerminBody, token: string) => apiFetch<Termin>('/v1/shows/' + showId + '/termins', { method: 'POST', body: JSON.stringify(body), token }),
  update: (showId: string, id: string, body: Partial<CreateTerminBody>, token: string) => apiFetch<Termin>('/v1/shows/' + showId + '/termins/' + id, { method: 'PATCH', body: JSON.stringify(body), token }),
  delete: (showId: string, id: string, token: string) => apiFetch<void>('/v1/shows/' + showId + '/termins/' + id, { method: 'DELETE', token }),
};

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
  capacity?: number;
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
  capacity?: number;
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
}

export interface PublicShowDetail {
  id: string;
  slug: string;
  name: string;
  description?: string;
  category?: string;
  images: ShowImage[];
  termins: PublicTerminDetail[];
}

export const publicApi = {
  listShows: (params?: { category?: string; date?: string; city?: string }) => {
    const q = new URLSearchParams();
    if (params?.category) q.set('category', params.category);
    if (params?.date) q.set('date', params.date);
    if (params?.city) q.set('city', params.city);
    const qs = q.toString();
    return apiFetch<PublicShow[]>(`/v1/public/shows${qs ? '?' + qs : ''}`);
  },
  getShow: (slug: string) => apiFetch<PublicShowDetail>(`/v1/public/shows/${slug}`),
  getFilters: () => apiFetch<{ categories: string[]; cities: string[] }>('/v1/public/filters'),
};

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
  items: { ticketTypeId: string; quantity: number }[];
  acceptTerms: true;
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
}

export const ordersApi = {
  create: (body: CreateOrderPayload, token: string) =>
    apiFetch<Order>('/v1/orders', { method: 'POST', body: JSON.stringify(body), token }),
  get: (id: string, token: string) =>
    apiFetch<Order>('/v1/orders/' + id, { token }),
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
