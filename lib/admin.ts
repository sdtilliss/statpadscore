import { createHash, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';

export const ADMIN_COOKIE = 'statpad_admin';

export function hashPassword(p: string): string {
  return createHash('sha256').update(p).digest('hex');
}

export function expectedAdminToken(): string | null {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) return null;
  return hashPassword(pw);
}

export function tokensMatch(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

export async function isAdmin(): Promise<boolean> {
  const expected = expectedAdminToken();
  if (!expected) return false;
  const cookieStore = await cookies();
  const c = cookieStore.get(ADMIN_COOKIE);
  if (!c?.value) return false;
  return tokensMatch(c.value, expected);
}
