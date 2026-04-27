import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_COOKIE, expectedAdminToken, hashPassword, tokensMatch } from '@/lib/admin';

export async function POST(req: NextRequest) {
  const { password } = await req.json().catch(() => ({ password: '' }));
  const expected = expectedAdminToken();
  if (!expected) {
    return NextResponse.json({ error: 'Admin not configured' }, { status: 500 });
  }
  const submitted = hashPassword(String(password || ''));
  if (!tokensMatch(submitted, expected)) {
    return NextResponse.json({ error: 'Wrong password' }, { status: 401 });
  }
  const res = NextResponse.json({ success: true });
  res.cookies.set(ADMIN_COOKIE, expected, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24, // 1 day
  });
  return res;
}
