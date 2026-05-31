import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const res = NextResponse.json({ ok: true });
  res.cookies.set('refresh_token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/auth',
    domain: process.env.NODE_ENV === 'production' ? '.ticketall.eu' : undefined,
    maxAge: 0,
  });
  return res;
}
