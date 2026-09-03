import type { Score } from './types';
import { scoreDirection } from './scoreDirection';

// Best-first comparator for scores within a single (day, sport) group —
// shared by the Today tab, triple crowns, and the wins/placement stats so
// they always agree on who "won" a given day.
//
// When every score in the group shares the same category (the normal case —
// one puzzle per sport per day), everyone played the identical grid, so
// direction-adjusted raw score is the fair comparison: it doesn't drift
// through the day the way Statpad's live global percentile does. Exact ties
// (same category, same raw score) fall back to percentile as a tiebreak.
//
// If two scores in the group have different categories, that's a parsing
// anomaly (e.g. a bad OCR read), not the normal case — raw scores from
// different categories aren't comparable, so fall back to percentile.
export function compareForRanking(a: Score, b: Score): number {
  if (a.category === b.category) {
    const dir = scoreDirection(a.sport, a.category);
    const diff = (b.totalScore - a.totalScore) * dir;
    if (diff !== 0) return diff;
    return b.percentile - a.percentile;
  }
  return b.percentile - a.percentile || b.totalScore - a.totalScore;
}
