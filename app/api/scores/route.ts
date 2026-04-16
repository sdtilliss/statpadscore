import { NextRequest, NextResponse } from 'next/server';
import { getScoresByDate, getRecentScores } from '@/lib/kv';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const leagueId = searchParams.get('leagueId');
  const mode = searchParams.get('mode');

  if (!leagueId) {
    return NextResponse.json({ error: 'Missing leagueId' }, { status: 400 });
  }

  if (mode === 'alltime') {
    const scores = await getRecentScores(leagueId, 90);
    return NextResponse.json(scores);
  }

  const date = searchParams.get('date') || new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  const scores = await getScoresByDate(leagueId, date);
  return NextResponse.json(scores);
}
