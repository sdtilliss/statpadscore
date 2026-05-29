import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/admin';
import { getAllLeagues, getLeagueStats } from '@/lib/kv';

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const leagues = await getAllLeagues();
  const entries = await Promise.all(
    leagues.map(async (l) => [l.id, await getLeagueStats(l.id)] as const),
  );
  return NextResponse.json(Object.fromEntries(entries));
}
