import { NextRequest, NextResponse } from 'next/server';
import { authApi, ApiError } from '@/lib/api';

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/api/auth',
  domain: process.env.NODE_ENV === 'production' ? '.ticketall.eu' : undefined,
};

export async function POST(req: NextRequest) {
  const refreshToken = req.cookies.get('refresh_token')?.value;
  if (!refreshToken) return NextResponse.json({ message: 'No refresh token' }, { status: 401 });

  try {
    const tokens = await authApi.refresh(refreshToken);
    const res = NextResponse.json({ accessToken: tokens.accessToken, expiresIn: tokens.expiresIn });
    res.cookies.set('refresh_token', tokens.refreshToken, {
      ...COOKIE_OPTS,
      maxAge: 60 * 60 * 24 * 7,
    });
    return res;
  } catch (err: unknown) {
    // Cookie mažeme LEN keď backend token definitívne odmietol (401). Pri 5xx,
    // sieťovej chybe či timeoute (err nie je ApiError, alebo status >= 500) ju
    // NECHÁME – inak by jeden výpadok backendu odhlásil natrvalo, hoci token
    // je stále platný a ďalší pokus by prešiel.
    const status = err instanceof ApiError ? err.status : 0;
    const message = err instanceof Error ? err.message : 'Refresh failed';

    if (status === 401) {
      const res = NextResponse.json({ message }, { status: 401 });
      res.cookies.set('refresh_token', '', { ...COOKIE_OPTS, maxAge: 0 });
      return res;
    }

    // Prechodná chyba – cookie ostáva, klient to skúsi znova.
    return NextResponse.json({ message }, { status: 503 });
  }
}
