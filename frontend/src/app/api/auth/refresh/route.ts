import { NextRequest, NextResponse } from 'next/server';
import { authApi } from '@/lib/api';

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
  } catch (err: any) {
    const res = NextResponse.json({ message: err.message }, { status: 401 });
    res.cookies.set('refresh_token', '', { ...COOKIE_OPTS, maxAge: 0 });
    return res;
  }
}
