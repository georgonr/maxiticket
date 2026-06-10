import { apiFetch } from '@/lib/api';

// ── Response typy (zhodné s backend metrics shape, commit 042395b) ──────────────

export interface AdminOverview {
  todayRevenue: number;
  ticketsSoldToday: number;
  activeShowsCount: number;
  organizersCount: number;
  pendingRefundsCount: number;
  todayRevenueChange: number; // signed %
  ticketsSoldChange: number; // signed %
}

export interface SalesTrendPoint {
  date: string; // YYYY-MM-DD
  revenue: number;
  ticketsSold: number;
}

export interface TopShow {
  showId: string;
  slug: string;
  title: string;
  revenue: number;
  ticketsSold: number;
  organizerName: string;
}

export interface RecentOrder {
  orderId: string;
  orderNumber: string;
  status: string;
  totalAmount: number;
  buyerName: string | null;
  buyerEmail: string;
  showTitle: string | null;
  ticketCount: number;
  createdAt: string;
}

export interface OrganizerRow {
  organizerId: string;
  name: string;
  slug: string;
  companyName: string | null;
  showsCount: number;
  publishedShowsCount: number;
  totalRevenue: number;
  totalTicketsSold: number;
  outstandingPayout: number;
}

export type OrganizerSort = 'revenue' | 'ticketsSold' | 'name';

export interface OrganizerOverview {
  myShowsCount: number;
  myPublishedShowsCount: number;
  myTodayRevenue: number;
  myTotalRevenue: number;
  myTicketsSoldToday: number;
  myTotalTicketsSold: number;
  myUpcomingTermins: number;
  myCapacityTotal: number;
  myCapacityFilled: number;
}

// ── helper ──────────────────────────────────────────────────────────────────

function qs(params: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}

// ── ADMIN (SUPERADMIN-only) ─────────────────────────────────────────────────

export const adminMetricsApi = {
  getOverview: (token: string) =>
    apiFetch<AdminOverview>('/v1/admin/metrics/overview', { token }),

  getSalesTrend: (token: string, params: { days?: number } = {}) =>
    apiFetch<SalesTrendPoint[]>(`/v1/admin/metrics/sales-trend${qs({ days: params.days ?? 7 })}`, { token }),

  getTopShows: (token: string, params: { limit?: number } = {}) =>
    apiFetch<TopShow[]>(`/v1/admin/metrics/top-shows${qs({ limit: params.limit ?? 5 })}`, { token }),

  getRecentOrders: (token: string, params: { limit?: number } = {}) =>
    apiFetch<RecentOrder[]>(`/v1/admin/metrics/recent-orders${qs({ limit: params.limit ?? 5 })}`, { token }),

  getOrganizers: (token: string, params: { limit?: number; sort?: OrganizerSort } = {}) =>
    apiFetch<OrganizerRow[]>(
      `/v1/admin/metrics/organizers${qs({ limit: params.limit ?? 20, sort: params.sort ?? 'revenue' })}`,
      { token },
    ),
};

// ── ORGANIZER (ORGANIZER_OWNER/MEMBER + SUPERADMIN via ?organizerId) ──────────

export const organizerMetricsApi = {
  getOverview: (token: string, params: { organizerId?: string } = {}) =>
    apiFetch<OrganizerOverview>(`/v1/organizer/metrics/overview${qs({ organizerId: params.organizerId })}`, { token }),

  getSalesTrend: (token: string, params: { days?: number; organizerId?: string } = {}) =>
    apiFetch<SalesTrendPoint[]>(
      `/v1/organizer/metrics/sales-trend${qs({ days: params.days ?? 7, organizerId: params.organizerId })}`,
      { token },
    ),

  getTopShows: (token: string, params: { limit?: number; organizerId?: string } = {}) =>
    apiFetch<TopShow[]>(
      `/v1/organizer/metrics/top-shows${qs({ limit: params.limit ?? 5, organizerId: params.organizerId })}`,
      { token },
    ),

  getRecentOrders: (token: string, params: { limit?: number; organizerId?: string } = {}) =>
    apiFetch<RecentOrder[]>(
      `/v1/organizer/metrics/recent-orders${qs({ limit: params.limit ?? 10, organizerId: params.organizerId })}`,
      { token },
    ),
};
