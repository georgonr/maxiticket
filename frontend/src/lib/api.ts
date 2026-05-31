const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.ticketall.eu';

type FetchOptions = RequestInit & { token?: string };

export async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { token, headers, body, ...rest } = options;
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
  list: (token: string) => apiFetch<Venue[]>('/v1/venues', { token }),
  create: (body: CreateVenueBody, token: string) => apiFetch<Venue>('/v1/venues', { method: 'POST', body: JSON.stringify(body), token }),
};

export const terminsApi = {
  list: (showId: string, token: string) => apiFetch<Termin[]>('/v1/shows/' + showId + '/termins', { token }),
  get: (showId: string, id: string, token: string) => apiFetch<Termin>('/v1/shows/' + showId + '/termins/' + id, { token }),
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

export type HeroSlideType =
  | { type: 'banner'; id: string; title: string; subtitle: string | null; imageUrl: string; ctaLabel: string | null; ctaUrl: string | null }
  | { type: 'show'; id: string; slug: string; name: string; imageUrl: string | null; startsAt: string; timezone: string; city: string | null; venueName: string | null; ctaUrl: string };

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
  getHero: () => apiFetch<HeroSlideType[]>('/v1/public/hero'),
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
  /** Initiate payment – returns { url } to redirect to (Stripe or success page for mock). */
  checkout: (id: string, token: string) =>
    apiFetch<{ url: string }>('/v1/orders/' + id + '/checkout', { method: 'POST', token }),
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
