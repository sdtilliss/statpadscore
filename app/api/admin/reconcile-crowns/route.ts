import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/lib/admin';
import { getAllDates, getScoresByDate, getTripleCrowns, replaceTripleCrowns } from '@/lib/kv';
import { evaluateTripleCrown } from '@/lib/triplecrowns';

// Corrective backfill: re-evaluates every stored day against the CURRENT
// triple-crown logic (raw score, direction-adjusted, within a day+sport —
// see lib/ranking.ts) and overwrites the persisted crowns list to match.
//
// Unlike /api/admin/backfill-crowns, which only fills in dates that have no
// crown recorded yet, this one corrects dates that already have a winner on
// record — addTripleCrown dedupes purely by date, so it can never fix a
// crown that was recorded under the old percentile-only logic and would now
// go to someone else (or to nobody, or to someone new).
//
// Dates outside the scanned window (older than the 365-entry cap on the
// dates index) are left untouched, not dropped.
//
// Usage (while logged into /admin, so the cookie rides along):
//   /api/admin/reconcile-crowns?leagueId=xxx&dryRun=1   -> preview, writes nothing
//   /api/admin/reconcile-crowns?leagueId=xxx            -> overwrites the crowns list

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

  const [dates, existing] = await Promise.all([getAllDates(leagueId), getTripleCrowns(leagueId)]);
  const dayScores = await Promise.all(dates.map((d) => getScoresByDate(leagueId, d)));
  const existingByDate = new Map(existing.map((c) => [c.date, c.playerName]));

  const recomputed: { leagueId: string; date: string; playerName: string }[] = [];
  const changes: { date: string; before: string | null; after: string | null }[] = [];

  dates.forEach((date, i) => {
    const winner = evaluateTripleCrown(dayScores[i]);
    const before = existingByDate.get(date) ?? null;
    if (winner) recomputed.push({ leagueId, date, playerName: winner });
    if (winner !== before) changes.push({ date, before, after: winner });
  });
  changes.sort((a, b) => a.date.localeCompare(b.date));

  const scannedDates = new Set(dates);
  const untouched = existing.filter((c) => !scannedDates.has(c.date));
  const finalCrowns = [...untouched, ...recomputed].sort((a, b) => a.date.localeCompare(b.date));

  if (dryRun) {
    return NextResponse.json({
      leagueId, dryRun: true, daysScanned: dates.length,
      existingCrowns: existing.length, recomputedCrowns: recomputed.length,
      changeCount: changes.length, changes,
    });
  }

  await replaceTripleCrowns(leagueId, finalCrowns);

  return NextResponse.json({
    leagueId, dryRun: false, daysScanned: dates.length,
    existingCrowns: existing.length, recomputedCrowns: recomputed.length,
    changeCount: changes.length, changes,
  });
}
