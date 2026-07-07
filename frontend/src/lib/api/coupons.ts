import { apiFetch } from '@/lib/api';

export type CouponType = 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_TICKET';
export type CouponScope = 'GLOBAL' | 'ORGANIZER' | 'SHOW' | 'TICKET_TYPE';
export type CouponStatus = 'active' | 'scheduled' | 'expired' | 'exhausted';

export interface ValidateCouponItem {
  ticketTypeId: string;
  quantity: number;
}

export interface ValidateCouponPayload {
  code: string;
  subtotal: number;
  items: ValidateCouponItem[];
  userId?: string;
}

// Doľaďovák 2: stabilné kódy dôvodov (i18n na frontende cez namespace coupon.reason.*).
export type CouponReasonCode =
  | 'NOT_FOUND'
  | 'NOT_YET_VALID'
  | 'EXPIRED'
  | 'EXHAUSTED'
  | 'MAX_USES_PER_USER'
  | 'MIN_ORDER_AMOUNT'
  | 'SCOPE_MISMATCH_ALL'
  | 'SCOPE_MISMATCH_NONE';

export type CouponValidationResult =
  | {
      valid: true;
      couponId: string;
      type: CouponType;
      scope: CouponScope;
      discount: number;
      finalAmount: number;
    }
  // `reason` (SK) ostáva ako fallback; `reasonCode` je preferovaný pre i18n.
  | { valid: false; reason: string; reasonCode?: CouponReasonCode; minOrderAmount?: number };

/** Surová podoba kupónu (backend serialize()) – vracia ju create. */
export interface CouponRecord {
  id: string;
  code: string;
  type: CouponType;
  value: number;
  scope: CouponScope;
  organizerId: string | null;
  showId: string | null;
  ticketTypeId: string | null;
  validFrom: string | null;
  validUntil: string | null;
  maxUses: number | null;
  maxUsesPerUser: number | null;
  minOrderAmount: number | null;
  usedCount: number;
  createdById: string | null;
  bulkBatchId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Položka v zozname (GET /v1/coupons → items[]): serialize() + odvodené meta. */
export interface CouponListItem extends CouponRecord {
  status: CouponStatus;
  scopeTargetName: string | null;
  redemptionsCount: number;
}

export interface CouponRedemption {
  id: string;
  orderNumber: string;
  userEmail: string | null;
  discountAmount: number;
  redeemedAt: string;
}

/** GET /v1/coupons/:id – serialize() + status + zoznam redemptions. */
export interface CouponDetail extends CouponRecord {
  status: CouponStatus;
  scopeTargetName: string | null;
  redemptions: CouponRedemption[];
}

export interface CouponListResponse {
  items: CouponListItem[];
  total: number;
  limit: number;
  offset: number;
}

/** GET /v1/coupons/stats?showId= – agregácia predaja per kupón (C8 affiliate tracking). */
export interface CouponStat {
  couponId: string;
  code: string;
  ticketsSold: number;
  revenue: number;
  scanned: number;
}

export interface ListCouponsQuery {
  scope?: CouponScope;
  status?: CouponStatus | 'all';
  organizerId?: string;
  showId?: string;
  relevantToShowId?: string;
  bulkBatchId?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

/** Spoločné polia pre create + bulk (zhoda s backend DTO). */
export interface CouponBaseInput {
  type: CouponType;
  value: number;
  scope: CouponScope;
  organizerId?: string;
  showId?: string;
  ticketTypeId?: string;
  validFrom?: string;
  validUntil?: string;
  maxUses?: number;
  maxUsesPerUser?: number;
  minOrderAmount?: number;
}

export interface CreateCouponInput extends CouponBaseInput {
  /** Voliteľný – ak chýba, backend auto-generuje kód. */
  code?: string;
}

export interface BulkGenerateInput extends CouponBaseInput {
  count: number;
  /** Default = email tvorcu (doplní backend). */
  sendToEmail?: string;
  /** Krok 31e2: jazyk staff aktéra pre lokalizovaný coupon-batch e-mail. */
  locale?: 'sk' | 'en' | 'cs';
}

export interface BulkGenerateResult {
  batchId: string;
  count: number;
  sentTo: string;
  /** Náhľad prvých 10 kódov. */
  codes: string[];
}

function toQuery(query: ListCouponsQuery): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
  }
  const s = params.toString();
  return s ? `?${s}` : '';
}

/** PUBLIC – validácia kupónu pri checkout (žiadny auth header). */
export const couponsApi = {
  validate: (payload: ValidateCouponPayload) =>
    apiFetch<CouponValidationResult>('/v1/coupons/validate', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

/** ADMIN/ORGANIZER – správa kupónov (vyžaduje token, role SUPERADMIN/ORGANIZER_OWNER). */
export const couponsAdminApi = {
  list: (query: ListCouponsQuery, token: string) =>
    apiFetch<CouponListResponse>('/v1/coupons' + toQuery(query), { token }),

  get: (id: string, token: string) =>
    apiFetch<CouponDetail>('/v1/coupons/' + id, { token }),

  stats: (showId: string, token: string) =>
    apiFetch<CouponStat[]>('/v1/coupons/stats?showId=' + encodeURIComponent(showId), { token }),

  create: (input: CreateCouponInput, token: string) =>
    apiFetch<{ coupon: CouponRecord }>('/v1/coupons', {
      method: 'POST',
      body: JSON.stringify(input),
      token,
    }).then((r) => r.coupon),

  bulkGenerate: (input: BulkGenerateInput, token: string) =>
    apiFetch<BulkGenerateResult>('/v1/coupons/bulk-generate', {
      method: 'POST',
      body: JSON.stringify(input),
      token,
    }),

  delete: (id: string, token: string) =>
    apiFetch<void>('/v1/coupons/' + id, { method: 'DELETE', token }),
};
