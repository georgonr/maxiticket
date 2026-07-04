import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Bezstavový podpísaný token pre HOSŤOVSKÝ prístup k lístkom objednávky.
 * HMAC-SHA256 nad {orderId, scope, exp}, platnosť 1h. Žiadne úložisko (Redis/DB) –
 * token sa vydá on-demand po PAID a overí sa podpisom + expiráciou. Rovnaký secret
 * ako QR podpis lístka (QR_HMAC_SECRET ?? JWT_SECRET).
 */
const SCOPE = 'guest_ticket';
export const GUEST_TICKET_TTL_SEC = 3600; // 1 hodina

export function guestTicketSecret(qrSecret?: string, jwtSecret?: string): string {
  const s = qrSecret ?? jwtSecret;
  if (!s) throw new Error('Missing QR_HMAC_SECRET/JWT_SECRET for guest ticket token');
  return s;
}

// Oddeľovač payload/sig: '~' (unreserved v URL, NIE je v base64url abecede). Pozor: NEpoužívať '.',
// find-my-way (Fastify router) nematchne dlhý path-param s bodkou → route 404.
const SEP = '~';

export function signGuestTicketToken(orderId: string, secret: string, ttlSec = GUEST_TICKET_TTL_SEC): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSec;
  const payload = Buffer.from(JSON.stringify({ o: orderId, s: SCOPE, exp })).toString('base64url');
  const sig = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}${SEP}${sig}`;
}

/** Vráti { orderId } len ak podpis sedí, scope je správny a token NEvypršal; inak null. */
export function verifyGuestTicketToken(token: string, secret: string): { orderId: string } | null {
  if (!token || typeof token !== 'string') return null;
  const sep = token.indexOf(SEP);
  if (sep <= 0) return null;
  const payload = token.slice(0, sep);
  const sig = token.slice(sep + 1);
  if (!payload || !sig) return null;

  const expected = createHmac('sha256', secret).update(payload).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  let data: { o?: unknown; s?: unknown; exp?: unknown };
  try {
    data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (data.s !== SCOPE || typeof data.o !== 'string' || typeof data.exp !== 'number') return null;
  if (data.exp < Math.floor(Date.now() / 1000)) return null; // expirované → 410
  return { orderId: data.o };
}
