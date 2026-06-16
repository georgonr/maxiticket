import { apiFetch } from '@/lib/api';
import { BillingMode } from '@/lib/api/organizers-admin';

export interface BillingOrganizerRow {
  organizerId: string;
  name: string;
  companyName: string | null;
  billingMode: BillingMode;
  revenueCents: number;
  netPayoutCents: number;
}

export interface BillingStatement {
  ticketsSold: number;
  revenueCents: number;
  commissionPercent: number;
  commissionCents: number;
  vatPercent: number;
  vatCents: number;
  refundedTickets: number;
  refundFeePerTicketCents: number;
  refundFeesCents: number;
  netPayoutCents: number;
  customerFeesCents: number;
}

export interface BillingPastTermin {
  id: string;
  startsAt: string;
  endsAt: string | null;
  showName: string | null;
}

/** SUPERADMIN/STAFF – read-only fakturačný prehľad. */
export const billingApi = {
  organizers: (token: string) =>
    apiFetch<BillingOrganizerRow[]>('/v1/admin/billing/organizers', { token }),

  pastTermins: (id: string, token: string) =>
    apiFetch<BillingPastTermin[]>(`/v1/admin/billing/organizers/${id}/past-termins`, { token }),

  statementByTermin: (id: string, occurrenceId: string, token: string) =>
    apiFetch<BillingStatement>(`/v1/admin/billing/organizers/${id}/statement?occurrenceId=${occurrenceId}`, { token }),

  statementByRange: (id: string, from: string, to: string, token: string) =>
    apiFetch<BillingStatement>(`/v1/admin/billing/organizers/${id}/statement?from=${from}&to=${to}`, { token }),
};
