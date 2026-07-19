import { NextRequest, NextResponse } from 'next/server';
import { getScoresByDate, getRecentScores, getAllDates } from '@/lib/kv';
import { getStatpadDate } from '@/lib/date';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const leagueId = searchParams.get('leagueId');
  const mode = searchParams.get('mode');

  if (!leagueId) {
    return NextResponse.json({ error: 'Missing leagueId' }, { status: 400 });
  }

  if (mode === 'alltime') {
    // Cover the full retained history (the date index keeps up to 365 days),
    // so "All-Time" isn't silently capped to a 90-day window.
    const scores = await getRecentScores(leagueId, 365);
    return NextResponse.json(scores);
  }

  if (mode === 'dates') {
    const dates = await getAllDates(leagueId);
    return NextResponse.json(dates);
  }

  const date = searchParams.get('date') || getStatpadDate();
  const scores = await getScoresByDate(leagueId, date);
  return NextResponse.json(scores);
}
