import { NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/lib/session';

const secure = process.env.NODE_ENV === 'production';

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
    secure
  });
  return res;
}
