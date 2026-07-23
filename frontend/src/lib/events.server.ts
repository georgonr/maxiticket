import 'server-only';
import type { PublicShow, PublicShowDetail, QrTicketInfo } from './api';

/**
 * Server-side načítanie verejných predajných dát (krok 50, audit V5). Rovnaký vzor
 * ako platform-info.server.ts / terms.server.ts (krok 40/42): SSR vnútornou sieťou
 * na backend, aby boli ceny/typy/dostupnosť v úvodnom HTML – crawlable (SEO) a
 * odolné voči ad-blockeru. Predtým to bežalo klientskym cross-origin fetchom v
 * useEffect s .catch(() => prázdno), takže pri blokovaní/výpadku sa zobrazila
 * prázdna stránka namiesto obsahu.
 *
 * ROZLIŠUJEME 404 (neexistuje) od inej chyby (výpadok) – volajúci tak vie zobraziť
 * „nenašlo sa" vs „nepodarilo sa načítať" namiesto zavádzajúceho prázdna (V6).
 */
const INTERNAL_API = process.env.INTERNAL_API_URL ?? 'http://backend:3001';

export type SsrResult<T> =
  | { status: 'ok'; data: T }
  | { status: 'notfound' }
  | { status: 'error' };

async function fetchSsr<T>(path: string, tag: string): Promise<SsrResult<T>> {
  try {
    // no-store: dostupnosť/ceny musia byť pri každom načítaní aktuálne (real-time predaj).
    const res = await fetch(`${INTERNAL_API}${path}`, { cache: 'no-store' });
    if (res.status === 404) return { status: 'notfound' };
    if (!res.ok) {
      console.error(`[${tag}] endpoint vrátil HTTP ${res.status}`);
      return { status: 'error' };
    }
    return { status: 'ok', data: (await res.json()) as T };
  } catch (e) {
    console.error(`[${tag}] server fetch zlyhal:`, e instanceof Error ? e.message : e);
    return { status: 'error' };
  }
}

/** Detail podujatia podľa slugu (ceny, typy lístkov, dostupnosť, sekcie). */
export function getShowSSR(slug: string): Promise<SsrResult<PublicShowDetail>> {
  return fetchSsr<PublicShowDetail>(`/v1/public/shows/${encodeURIComponent(slug)}`, 'show');
}

/** Katalóg podujatí s filtrom. Vracia error/ok – prázdny zoznam je legitímny (0 podujatí). */
export function listShowsSSR(params: {
  q?: string; category?: string; date?: string; city?: string;
}): Promise<SsrResult<PublicShow[]>> {
  const qs = new URLSearchParams();
  if (params.q) qs.set('q', params.q);
  if (params.category) qs.set('category', params.category);
  if (params.date) qs.set('date', params.date);
  if (params.city) qs.set('city', params.city);
  const s = qs.toString();
  return fetchSsr<PublicShow[]>(`/v1/public/shows${s ? '?' + s : ''}`, 'shows');
}

/** Mestá pre filter (best-effort – prázdne pole pri zlyhaní, filter je nekritický). */
export async function getFilterCitiesSSR(): Promise<string[]> {
  const r = await fetchSsr<{ categories: string[]; cities: string[] }>('/v1/public/filters', 'filters');
  return r.status === 'ok' ? (r.data.cities ?? []) : [];
}

/** QR scan-to-buy: údaje o type lístka + cena + purchasable/reason. */
export function getQrInfoSSR(ticketTypeId: string): Promise<SsrResult<QrTicketInfo>> {
  return fetchSsr<QrTicketInfo>(`/v1/public/qr/${encodeURIComponent(ticketTypeId)}`, 'qr');
}
