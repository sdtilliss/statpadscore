import { NextRequest, NextResponse } from 'next/server';
import { getTripleCrowns } from '@/lib/kv';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const leagueId = searchParams.get('leagueId');

  if (!leagueId) {
    return NextResponse.json({ error: 'Missing leagueId' }, { status: 400 });
  }

  const crowns = await getTripleCrowns(leagueId);
  return NextResponse.json(crowns);
}
