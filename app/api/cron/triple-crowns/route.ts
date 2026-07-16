import { NextRequest, NextResponse } from 'next/server';
import { getAllLeagues, getScoresByDate, addTripleCrown } from '@/lib/kv';
import { getStatpadDate } from '@/lib/date';
import { evaluateTripleCrown } from '@/lib/triplecrowns';

// The Statpad day immediately before `date` (YYYY-MM-DD). Anchor at noon UTC so
// the ±1h DST wobble never pushes us onto the wrong calendar day.
function previousDay(date: string): string {
  const d = new Date(date + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().split('T')[0];
}

// Runs once each morning (Vercel Cron, 12:00 UTC = 4am PST / 5am PDT — always
// after the 3am PT day boundary). By then getStatpadDate() has rolled to the
// new day, so we evaluate the day that just closed and record any triple crown.
export async function GET(req: NextRequest) {
  // Vercel Cron attaches `Authorization: Bearer $CRON_SECRET` when the env var
  // is set. If it's unset we skip the check (the write is idempotent anyway).
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const date = previousDay(getStatpadDate());
  const leagues = await getAllLeagues();

  const crowned: { leagueId: string; playerName: string }[] = [];
  for (const league of leagues) {
    const scores = await getScoresByDate(league.id, date);
    const winner = evaluateTripleCrown(scores);
    if (winner && (await addTripleCrown({ leagueId: league.id, date, playerName: winner }))) {
      crowned.push({ leagueId: league.id, playerName: winner });
    }
  }

  return NextResponse.json({ date, leaguesChecked: leagues.length, crowned });
}
