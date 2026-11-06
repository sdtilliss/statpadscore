import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/lib/admin';
import { getAllDates, getAllLeagues, getScoresByDate, replaceScoresForDate } from '@/lib/kv';
import { MAGIC_BEAN_TILES } from '@/lib/magicBean';
import { normalizeSport } from '@/lib/sports';

// Grant a Magic Bean (perfect grid) to a player's most recent submission in a
// sport — for perfect grids submitted before Magic Beans existed. Sets
// magicBean, overrides percentile to 100, and bumps purpleTiles to 5.
// New submissions get this automatically in /api/submit.
//
// Admin-gated and idempotent. leagueId is optional: without it, every league
// the player has submitted to is updated (their most recent score in each).
//
// Usage (while logged into /admin, so the cookie rides along):
//   /api/admin/magic-bean?player=Quan&sport=NFL&dryRun=1   -> preview, writes nothing
//   /api/admin/magic-bean?player=Quan&sport=NFL            -> grants it
export async function GET(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const player = searchParams.get('player')?.trim().toLowerCase();
  const sport = normalizeSport(searchParams.get('sport') ?? '');
  const onlyLeague = searchParams.get('leagueId');
  const dryRun = searchParams.get('dryRun') === '1';
  if (!player || !sport) {
    return NextResponse.json({ error: 'Need player and sport (MLB/NFL/NBA/NHL)' }, { status: 400 });
  }

  const leagueIds = onlyLeague ? [onlyLeague] : (await getAllLeagues()).map((l) => l.id);
  const results = [];

  for (const leagueId of leagueIds) {
    // dates index is newest-first, so the first hit is the most recent score.
    for (const date of await getAllDates(leagueId)) {
      const scores = await getScoresByDate(leagueId, date);
      const idx = scores.findIndex((s) => s.playerName.toLowerCase() === player && s.sport === sport);
      if (idx === -1) continue;

      const before = scores[idx];
      const after = {
        ...before,
        magicBean: true,
        percentile: 100,
        purpleTiles: Math.max(before.purpleTiles ?? 0, MAGIC_BEAN_TILES),
      };
      results.push({
        leagueId, date, scoreId: before.id, playerName: before.playerName,
        totalScore: before.totalScore,
        before: { percentile: before.percentile, purpleTiles: before.purpleTiles ?? 0, magicBean: !!before.magicBean },
        after: { percentile: 100, purpleTiles: after.purpleTiles, magicBean: true },
      });
      if (!dryRun) {
        scores[idx] = after;
        await replaceScoresForDate(leagueId, date, scores);
      }
      break;
    }
  }

  if (results.length === 0) {
    return NextResponse.json({ error: `No ${sport} score found for "${player}"` }, { status: 404 });
  }
  return NextResponse.json({ dryRun, updated: results });
}
