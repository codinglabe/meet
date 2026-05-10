import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { readSessionToken, SESSION_COOKIE } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  const user = await readSessionToken(token || '');
  if (!user) return NextResponse.json({ user: null });
  return NextResponse.json({
    user: { id: user.id, email: user.email, displayName: user.displayName }
  });
}
