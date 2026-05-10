import { NextResponse } from 'next/server';
import { createUser } from '@/lib/auth-store';
import { createSessionToken, SESSION_COOKIE } from '@/lib/session';

export const runtime = 'nodejs';

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  const displayName = String(body.displayName || '').trim();
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!emailOk) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  }

  try {
    const user = createUser({ email, password, displayName });
    const token = await createSessionToken(user);
    const res = NextResponse.json({ ok: true, user: { id: user.id, email: user.email, displayName: user.displayName } });
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
      secure: process.env.NODE_ENV === 'production'
    });
    return res;
  } catch (e) {
    return NextResponse.json({ error: e.message || 'Registration failed' }, { status: 400 });
  }
}
