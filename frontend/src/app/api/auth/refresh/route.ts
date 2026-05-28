import { NextRequest, NextResponse } from 'next/server';
import { authApi } from '@/lib/api';

export async function POST(req: NextRequest) {
  const refreshToken = req.cookies.get('refresh_token')?.value;
  if (!refreshToken) return NextResponse.json({ message: 'No refresh token' }, { status: 401 });

  try {
    const tokens = await authApi.refresh(refreshToken);
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
    const res = NextResponse.json({ message: err.message }, { status: 401 });
    res.cookies.delete('refresh_token');
    return res;
  }
}
