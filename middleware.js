import { NextResponse } from 'next/server';
import { readSessionToken } from './lib/session.js';

export async function middleware(request) {
  const { pathname } = request.nextUrl;
  if (!pathname.startsWith('/room/')) return NextResponse.next();

  const token = request.cookies.get('kreo_token')?.value;
  const user = await readSessionToken(token || '');
  if (!user) {
    const login = new URL('/login', request.url);
    login.searchParams.set('from', pathname);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = { matcher: ['/room/:path*'] };
