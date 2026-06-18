import { apiFetch } from '@/lib/api';
import { OrganizerRow, OrganizerSort } from '@/lib/api/metrics';

export type { OrganizerRow, OrganizerSort };

export interface OrganizerProfile {
  id: string;
  name: string;
  slug: string;
  email: string;
  phone: string | null;
  websiteUrl: string | null;
  companyName: string | null;
  ico: string | null;
  dic: string | null;
  icDph: string | null;
  vatPayer: boolean;
  addressStreet: string | null;
  addressCity: string | null;
  addressZip: string | null;
  addressCountry: string | null;
  bankAccount: string | null;
  iban: string | null;
  createdAt: string;
}

export interface OrganizerShowRow {
  id: string;
  name: string;
  slug: string;
  status: string;
  terminCount: number;
  createdAt: string;
}

export interface OrganizerDetail {
  organizer: OrganizerProfile;
  metrics: {
    showsCount: number;
    publishedShowsCount: number;
    totalRevenue: number;
    totalTicketsSold: number;
    outstandingPayout: number;
  };
  shows: OrganizerShowRow[];
}

function qs(params: Record<string, string | number | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
}

export type BillingMode = 'PER_EVENT' | 'MONTHLY';

/** Fakturačná konfigurácia (LEN super-admin/staff – organizátor NEVIDÍ). */
export interface OrganizerBilling {
  commissionPercent: number;
  vatPercent: number;
  feesIncluded: boolean;
  customerFeePercent: number;
  billingMode: BillingMode;
  refundFeePerTicketCents: number | null;
  ticketVatPercent: number; // eKasa: DPH sadzba lístka na eKasa doklade
}

/** SUPERADMIN/STAFF – zoznam VŠETKÝCH organizátorov + detail + fakturácia. */
export const organizersAdminApi = {
  list: (token: string, params: { sort?: OrganizerSort } = {}) =>
    apiFetch<OrganizerRow[]>(`/v1/admin/organizers${qs({ sort: params.sort })}`, { token }),

  get: (id: string, token: string) =>
    apiFetch<OrganizerDetail>(`/v1/admin/organizers/${id}`, { token }),

  getBilling: (id: string, token: string) =>
    apiFetch<OrganizerBilling>(`/v1/admin/organizers/${id}/billing`, { token }),

  updateBilling: (id: string, billing: OrganizerBilling, token: string) =>
    apiFetch<OrganizerBilling>(`/v1/admin/organizers/${id}/billing`, {
      method: 'PATCH',
      body: JSON.stringify(billing),
      token,
    }),
};
