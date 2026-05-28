import { NextRequest, NextResponse } from 'next/server';
import { authApi } from '@/lib/api';

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();

  try {
    const tokens = await authApi.login(email, password);
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
    return NextResponse.json({ message: err.message }, { status: err.status ?? 500 });
  }
}
