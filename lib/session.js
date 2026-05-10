'use strict';

import { SignJWT, jwtVerify } from 'jose';

function getSecret() {
  const s = process.env.AUTH_SECRET || 'dev-only-set-AUTH_SECRET-in-production-min-32-chars!!';
  return new TextEncoder().encode(s);
}

export async function createSessionToken(user) {
  return await new SignJWT({
    sub: user.id,
    email: user.email,
    name: user.displayName
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getSecret());
}

export async function readSessionToken(token) {
  if (!token || typeof token !== 'string') return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return {
      id: payload.sub,
      email: String(payload.email || ''),
      displayName: String(payload.name || 'Guest').slice(0, 60)
    };
  } catch {
    return null;
  }
}

export const SESSION_COOKIE = 'kreo_token';
