import { NextRequest, NextResponse } from 'next/server';

export type Area = 'public' | 'admin' | 'scanner';

function getArea(req: NextRequest): Area {
  const host = req.headers.get('host') ?? '';
  // Strip port for local dev
  const hostname = host.split(':')[0];

  if (hostname === 'admin.maxiticket.africa') return 'admin';
  if (hostname === 'skener.maxiticket.africa') return 'scanner';
  // localhost dev: use ?area= query param or x-area header
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    const param = req.nextUrl.searchParams.get('area');
    if (param === 'admin') return 'admin';
    if (param === 'scanner') return 'scanner';
  }
  return 'public';
}

export function middleware(req: NextRequest) {
  const area = getArea(req);
  const res = NextResponse.next();
  res.headers.set('x-area', area);
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons|manifest).*)'],
};
