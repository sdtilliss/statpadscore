import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/lib/admin';
import { getAllDates, getScoresByDate, addTripleCrown } from '@/lib/kv';
import { evaluateTripleCrown, TRIPLE_CROWN_SPORTS, TRIPLE_CROWN_MIN_PLAYERS } from '@/lib/triplecrowns';
import type { Score } from '@/lib/types';

// One-time historical backfill: runs the exact same evaluation the cron uses
// over every stored day for a league, so past triple crowns get counted.
// Admin-gated and idempotent (addTripleCrown dedupes by date), so it's safe to
// run more than once and safe to run alongside the daily cron.
//
// Usage (while logged into /admin, so the cookie rides along):
//   /api/admin/backfill-crowns?leagueId=xxx&dryRun=1   -> preview, writes nothing
//   /api/admin/backfill-crowns?leagueId=xxx            -> records the crowns

// How many distinct players submitted all tracked sports this day. Mirrors the
// gate inside evaluateTripleCrown, but exposed here purely to report *why* a day
// didn't crown (incomplete participation vs. complete-but-no-sweep).
function completePlayerCount(scores: Score[]): number {
  const byPlayer = new Map<string, Set<string>>();
  for (const s of scores) {
    const key = s.playerName.toLowerCase();
    let set = byPlayer.get(key);
    if (!set) { set = new Set(); byPlayer.set(key, set); }
    set.add(s.sport);
  }
  return [...byPlayer.values()].filter((sports) =>
    TRIPLE_CROWN_SPORTS.every((sp) => sports.has(sp))
  ).length;
}

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const leagueId = searchParams.get('leagueId');
  const dryRun = searchParams.get('dryRun') === '1';
  if (!leagueId) {
    return NextResponse.json({ error: 'Missing leagueId' }, { status: 400 });
  }

  const dates = await getAllDates(leagueId);
  const dayScores = await Promise.all(dates.map((d) => getScoresByDate(leagueId, d)));

  const found: { date: string; playerName: string }[] = [];
  let incompleteDays = 0;   // fewer than MIN_PLAYERS submitted all 3 sports
  let completeNoSweep = 0;  // full participation, but no single player swept
  dates.forEach((date, i) => {
    const scores = dayScores[i];
    if (completePlayerCount(scores) < TRIPLE_CROWN_MIN_PLAYERS) { incompleteDays++; return; }
    const winner = evaluateTripleCrown(scores);
    if (winner) found.push({ date, playerName: winner });
    else completeNoSweep++;
  });

  found.sort((a, b) => a.date.localeCompare(b.date)); // oldest-first, readable

  if (dryRun) {
    return NextResponse.json({
      leagueId, dryRun: true, daysScanned: dates.length,
      incompleteDays, completeNoSweep,
      wouldCrownCount: found.length, wouldCrown: found,
    });
  }

  // Sequential writes: the crowns list is a single key, so parallel
  // read-modify-write would clobber. Idempotent per date.
  let newlyAdded = 0, alreadyPresent = 0;
  for (const c of found) {
    const added = await addTripleCrown({ leagueId, date: c.date, playerName: c.playerName });
    if (added) newlyAdded++; else alreadyPresent++;
  }

  return NextResponse.json({
    leagueId, dryRun: false, daysScanned: dates.length,
    incompleteDays, completeNoSweep,
    crownsFound: found.length, newlyAdded, alreadyPresent, crowned: found,
  });
}
