import type { Score } from './types';

// A "triple crown" = one player holds the top spot (by percentile, matching the
// Today tab) in every tracked sport on a single Statpad day — but only once the
// day is genuinely contested: at least MIN_PLAYERS distinct players have each
// submitted all tracked sports. We gate on the *shape* of participation (N
// players × all sports) rather than a hardcoded roster, so it "just works" for
// any league that behaves like a full daily lineup.
export const TRIPLE_CROWN_SPORTS = ['MLB', 'NFL', 'NBA'];
export const TRIPLE_CROWN_MIN_PLAYERS = 4;

/**
 * Evaluate a single day's scores. Returns the winning player's name if the day
 * yielded a triple crown, otherwise null. Ties for the top of a sport are not
 * treated specially — the top score by percentile (then raw score, for
 * determinism) wins that sport.
 */
export function evaluateTripleCrown(scores: Score[]): string | null {
  // Group by player (case-insensitive), tracking which sports each covered.
  const byPlayer = new Map<string, { name: string; sports: Set<string> }>();
  for (const s of scores) {
    const key = s.playerName.toLowerCase();
    let entry = byPlayer.get(key);
    if (!entry) {
      entry = { name: s.playerName, sports: new Set() };
      byPlayer.set(key, entry);
    }
    entry.sports.add(s.sport);
  }

  // Gate: enough players have each submitted all tracked sports.
  const completePlayers = [...byPlayer.values()].filter((p) =>
    TRIPLE_CROWN_SPORTS.every((sport) => p.sports.has(sport))
  );
  if (completePlayers.length < TRIPLE_CROWN_MIN_PLAYERS) return null;

  // The same player must top every tracked sport.
  let champion: string | null = null;
  for (const sport of TRIPLE_CROWN_SPORTS) {
    const sportScores = scores.filter((s) => s.sport === sport);
    if (sportScores.length === 0) return null; // sport not contested this day
    const top = sportScores
      .slice()
      .sort((a, b) => b.percentile - a.percentile || b.totalScore - a.totalScore)[0];
    const topKey = top.playerName.toLowerCase();
    if (champion === null) champion = topKey;
    else if (champion !== topKey) return null; // different leaders — no sweep
  }

  if (!champion) return null;
  return byPlayer.get(champion)?.name ?? null; // return properly-cased name
}
