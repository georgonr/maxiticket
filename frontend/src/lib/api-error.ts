import { ApiError } from '@/lib/api';

/**
 * Krok 31e3: čítanie messageCode (+ params) z backend chyby pre i18n.
 * Backend (coded-exception + AllExceptionsFilter) vracia:
 *   body.message = { message: '<SK>', messageCode: '<CODE>', params?: {...} }
 * Spätná kompat: ak kód chýba, vraciame pôvodný `message` string (fallback).
 */
export interface ParsedApiError {
  code?: string;
  params?: Record<string, string | number>;
  message?: string;
}

export function parseApiError(err: unknown): ParsedApiError {
  if (!(err instanceof ApiError)) {
    return { message: err instanceof Error ? err.message : undefined };
  }
  const inner = (err.body as { message?: unknown })?.message;
  if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
    const o = inner as { message?: unknown; messageCode?: unknown; params?: unknown };
    return {
      code: typeof o.messageCode === 'string' ? o.messageCode : undefined,
      params: (o.params as Record<string, string | number>) ?? undefined,
      message: typeof o.message === 'string' ? o.message : undefined,
    };
  }
  return { message: typeof inner === 'string' ? inner : err.message };
}

/** next-intl translator (namespace `errors`) s .has() na bezpečný fallback. */
type ErrorsT = {
  (key: string, values?: Record<string, string | number>): string;
  has: (key: string) => boolean;
};

/**
 * Lokalizuje backend chybu: ak má messageCode a existuje preklad → t('CODE', params),
 * inak pôvodný backend `message`, inak `fallback`.
 */
export function localizeApiError(t: ErrorsT, err: unknown, fallback: string): string {
  const { code, params, message } = parseApiError(err);
  if (code && t.has(code)) return t(code, params ?? {});
  return message || fallback;
}
