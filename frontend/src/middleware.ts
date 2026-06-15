import { NextRequest, NextResponse } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export type Area = 'public' | 'admin' | 'scanner';

const intlMiddleware = createMiddleware(routing);

// Krok 31a: ploché (nelokalizované) cesty na PUBLIC hoste (ticketall.eu). DÔLEŽITÉ: organizer/admin
// app beží na ticketall.eu (admin.ticketall.eu je len legacy 301), preto /organizer /admin /scan
// MUSIA ostať ploché (next-intl ich neprefixuje na /sk). Lokalizuje sa len verejný obsah pod [locale].
const FLAT_PREFIXES = [
  '/login', '/register', '/forgot-password', '/reset-password',
  '/organizer', '/admin', '/scan',
];

function getArea(req: NextRequest): Area {
  const hostname = (req.headers.get('host') ?? '').split(':')[0];
  if (hostname === 'admin.ticketall.eu') return 'admin';
  if (hostname === 'skener.ticketall.eu') return 'scanner';
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    const param = req.nextUrl.searchParams.get('area');
    if (param === 'admin') return 'admin';
    if (param === 'scanner') return 'scanner';
  }
  return 'public';
}

export function middleware(req: NextRequest) {
  const area = getArea(req);

  // Admin/scanner subdomény: žiadny locale routing – len x-area (ploché cesty zachované).
  if (area !== 'public') {
    const res = NextResponse.next();
    res.headers.set('x-area', area);
    return res;
  }

  const path = req.nextUrl.pathname;

  // Public host: staff/auth ploché cesty ostávajú bez locale prefixu.
  if (FLAT_PREFIXES.some((p) => path === p || path.startsWith(p + '/'))) {
    const res = NextResponse.next();
    res.headers.set('x-area', 'public');
    return res;
  }

  // Public host: next-intl locale routing (/ → /sk; /events → /sk/events; …).
  const res = intlMiddleware(req);
  res.headers.set('x-area', 'public');
  return res;
}

export const config = {
  // Vylúč API, _next a statické súbory (s príponou). Zvyšok gateuje middleware vyššie.
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|icons|manifest|.*\\..*).*)'],
};
