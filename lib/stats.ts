import type { Score, PlayerStats } from './types';
import { getStatpadDate } from './date';

export function computePlayerStats(scores: Score[]): PlayerStats[] {
  const byPlayer: Record<string, Score[]> = {};
  for (const s of scores) {
    const key = s.playerName.toLowerCase();
    if (!byPlayer[key]) byPlayer[key] = [];
    byPlayer[key].push(s);
  }

  // Placement per score: rank within its (day, sport) group, ordered by
  // percentile then raw score — the same ordering as the Today tab and
  // Triple Crowns. Exact ties (same percentile AND score) share a rank, so
  // both tied leaders count a win.
  const placementById = new Map<string, number>();
  const byDaySport: Record<string, Score[]> = {};
  for (const s of scores) {
    const key = `${s.date}|${s.sport}`;
    if (!byDaySport[key]) byDaySport[key] = [];
    byDaySport[key].push(s);
  }
  for (const group of Object.values(byDaySport)) {
    const sorted = group
      .slice()
      .sort((a, b) => b.percentile - a.percentile || b.totalScore - a.totalScore);
    let rank = 0;
    for (let i = 0; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      if (!prev || prev.percentile !== sorted[i].percentile || prev.totalScore !== sorted[i].totalScore) {
        rank = i + 1;
      }
      placementById.set(sorted[i].id, rank);
    }
  }

  return Object.entries(byPlayer)
    .map(([, playerScores]) => {
      const name = playerScores[0].playerName;
      const dateSet = new Set(playerScores.map((s) => s.date));
      const dates = [...dateSet].sort();

      // Streak: consecutive Statpad days ending today.
      // Use the same 3am-PT day boundary as the rest of the app so the
      // streak doesn't drift by a day around midnight UTC.
      let streak = 0;
      let check = getStatpadDate();
      while (true) {
        if (dateSet.has(check)) {
          streak++;
          // Walk back one day in UTC (anchor at noon to dodge DST edges).
          const d = new Date(check + 'T12:00:00Z');
          d.setUTCDate(d.getUTCDate() - 1);
          check = d.toISOString().split('T')[0];
        } else {
          break;
        }
      }

      const avgPercentile =
        playerScores.reduce((a, b) => a + b.percentile, 0) / playerScores.length;

      const best = playerScores.reduce((a, b) => (b.totalScore > a.totalScore ? b : a));

      const sportBreakdown: Record<string, { count: number; avg: number; best: number; avgPercentile: number; bestPercentile: number; purpleHits: number; wins: number; avgPlacement: number }> = {};
      for (const s of playerScores) {
        if (!sportBreakdown[s.sport]) sportBreakdown[s.sport] = { count: 0, avg: 0, best: 0, avgPercentile: 0, bestPercentile: 0, purpleHits: 0, wins: 0, avgPlacement: 0 };
        sportBreakdown[s.sport].count++;
        sportBreakdown[s.sport].avg += s.totalScore;
        sportBreakdown[s.sport].avgPercentile += s.percentile;
        if (s.totalScore > sportBreakdown[s.sport].best) {
          sportBreakdown[s.sport].best = s.totalScore;
        }
        if (s.percentile > sportBreakdown[s.sport].bestPercentile) {
          sportBreakdown[s.sport].bestPercentile = s.percentile;
        }
        sportBreakdown[s.sport].purpleHits += s.purpleTiles || 0;
        const placement = placementById.get(s.id) ?? 1;
        if (placement === 1) sportBreakdown[s.sport].wins++;
        sportBreakdown[s.sport].avgPlacement += placement;
      }
      for (const sport of Object.keys(sportBreakdown)) {
        const c = sportBreakdown[sport].count;
        sportBreakdown[sport].avg = Math.round((sportBreakdown[sport].avg / c) * 10) / 10;
        sportBreakdown[sport].avgPercentile = Math.round((sportBreakdown[sport].avgPercentile / c) * 10) / 10;
        sportBreakdown[sport].avgPlacement = Math.round((sportBreakdown[sport].avgPlacement / c) * 10) / 10;
      }

      const placements = playerScores.map((s) => placementById.get(s.id) ?? 1);
      const wins = placements.filter((p) => p === 1).length;
      const avgPlacement =
        Math.round((placements.reduce((a, b) => a + b, 0) / placements.length) * 10) / 10;

      return {
        playerName: name,
        gamesPlayed: playerScores.length,
        daysPlayed: dates.length,
        avgPercentile: Math.round(avgPercentile * 10) / 10,
        bestScore: best.totalScore,
        bestScoreSport: best.sport,
        bestPercentile: Math.max(...playerScores.map((s) => s.percentile)),
        currentStreak: streak,
        purpleHits: playerScores.reduce((a, s) => a + (s.purpleTiles || 0), 0),
        wins,
        avgPlacement,
        sportBreakdown,
      };
    })
    .sort((a, b) => b.avgPercentile - a.avgPercentile);
}
