import 'server-only';
import type { PlatformInfoPublic } from './api';

/**
 * Server-side načítanie údajov prevádzkovateľa pre /gdpr a /kontakt (krok 40).
 *
 * Frontend a backend sú SAMOSTATNÉ build kontexty, takže PlatformInfoService sa
 * zo servera zavolať nedá – použije sa server-side fetch na VEREJNÝ endpoint
 * /v1/public/platform-info (getPublic() vracia LEN verejné polia: bez IBAN a
 * sadzieb DPH). Ide vnútornou sieťou (backend:3001), nie hairpinom cez Caddy.
 *
 * cache:'no-store' – údaje musia byť vždy aktuálne (zmena prevádzkovateľa).
 * Predtým to bežalo klientskym cross-origin fetchom v useEffect s .catch(()=>null),
 * takže pri zlyhaní volania blok ticho zmizol; SSR to má v úvodnom HTML.
 */
const INTERNAL_API = process.env.INTERNAL_API_URL ?? 'http://backend:3001';

export async function getPlatformInfo(): Promise<PlatformInfoPublic | null> {
  try {
    const res = await fetch(`${INTERNAL_API}/v1/public/platform-info`, { cache: 'no-store' });
    if (!res.ok) {
      console.error(`[platform-info] endpoint vrátil HTTP ${res.status}`);
      return null;
    }
    return (await res.json()) as PlatformInfoPublic;
  } catch (e) {
    console.error('[platform-info] server fetch zlyhal:', e instanceof Error ? e.message : e);
    return null;
  }
}
