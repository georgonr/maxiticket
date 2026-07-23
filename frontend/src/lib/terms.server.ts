import 'server-only';

/**
 * Server-side načítanie aktívnych platformových obchodných podmienok (krok 42).
 * Rovnaký vzor ako platform-info.server.ts (krok 40): SSR, vnútornou sieťou na
 * backend, cache:'no-store'. Verejný endpoint /v1/public/terms/:type.
 */
const INTERNAL_API = process.env.INTERNAL_API_URL ?? 'http://backend:3001';

export type TermsType = 'BUYER_PURCHASE' | 'ORGANIZER_REGISTRATION';

export interface PlatformTerms {
  version: string;
  publishedAt: string;
  content: string;
}

export async function getPlatformTerms(type: TermsType): Promise<PlatformTerms | null> {
  try {
    const res = await fetch(`${INTERNAL_API}/v1/public/terms/${type}`, { cache: 'no-store' });
    if (!res.ok) {
      console.error(`[terms] endpoint vrátil HTTP ${res.status}`);
      return null;
    }
    // Endpoint vracia null (JSON), keď znenie ešte nie je vložené.
    const data = (await res.json()) as PlatformTerms | null;
    return data && data.content ? data : null;
  } catch (e) {
    console.error('[terms] server fetch zlyhal:', e instanceof Error ? e.message : e);
    return null;
  }
}
