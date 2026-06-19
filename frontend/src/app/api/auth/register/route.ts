import { NextRequest, NextResponse } from 'next/server';
import { authApi, RegisterOrganizerPayload } from '@/lib/api';

export async function POST(req: NextRequest) {
  const body: RegisterOrganizerPayload = await req.json();

  try {
    const tokens = await authApi.register(body);
    const res = NextResponse.json({ accessToken: tokens.accessToken, expiresIn: tokens.expiresIn });
    res.cookies.set('refresh_token', tokens.refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/api/auth',
      maxAge: 60 * 60 * 24 * 7,
    });
    return res;
  } catch (err: any) {
    const inner = err?.body?.message;
    const messageCode = inner && typeof inner === 'object' ? inner.messageCode : undefined;
    const message = inner && typeof inner === 'object' ? inner.message : (err.message ?? 'Error');
    return NextResponse.json({ message, messageCode }, { status: err.status ?? 500 });
  }
}
