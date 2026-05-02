import type { Score, PlayerStats } from './types';

export function computePlayerStats(scores: Score[]): PlayerStats[] {
  const byPlayer: Record<string, Score[]> = {};
  for (const s of scores) {
    const key = s.playerName.toLowerCase();
    if (!byPlayer[key]) byPlayer[key] = [];
    byPlayer[key].push(s);
  }

  return Object.entries(byPlayer)
    .map(([, playerScores]) => {
      const name = playerScores[0].playerName;
      const dates = [...new Set(playerScores.map((s) => s.date))].sort();

      // Streak: consecutive days ending today or yesterday
      let streak = 0;
      const today = new Date().toISOString().split('T')[0];
      let check = today;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        if (dates.includes(check)) {
          streak++;
          const d = new Date(check);
          d.setDate(d.getDate() - 1);
          check = d.toISOString().split('T')[0];
        } else {
          break;
        }
      }

      const avgPercentile =
        playerScores.reduce((a, b) => a + b.percentile, 0) / playerScores.length;

      const best = playerScores.reduce((a, b) => (b.totalScore > a.totalScore ? b : a));

      const sportBreakdown: Record<string, { count: number; avg: number; best: number; avgPercentile: number; bestPercentile: number; purpleHits: number }> = {};
      for (const s of playerScores) {
        if (!sportBreakdown[s.sport]) sportBreakdown[s.sport] = { count: 0, avg: 0, best: 0, avgPercentile: 0, bestPercentile: 0, purpleHits: 0 };
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
      }
      for (const sport of Object.keys(sportBreakdown)) {
        const c = sportBreakdown[sport].count;
        sportBreakdown[sport].avg = Math.round((sportBreakdown[sport].avg / c) * 10) / 10;
        sportBreakdown[sport].avgPercentile = Math.round((sportBreakdown[sport].avgPercentile / c) * 10) / 10;
      }

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
        sportBreakdown,
      };
    })
    .sort((a, b) => b.avgPercentile - a.avgPercentile);
}
