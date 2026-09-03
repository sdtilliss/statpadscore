// Whether a HIGHER raw score means better performance for a sport+category.
// Derived from real submission history via pairwise concordance against
// Statpad's own percentile (see scripts/direction-audit.ts) — every category
// defaults to "higher is better"; only categories confidently found to run
// the other way (e.g. ERA) are listed as exceptions.
const LOWER_IS_BETTER = new Set<string>(['MLB::era']);

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function scoreDirection(sport: string, category: string): 1 | -1 {
  return LOWER_IS_BETTER.has(`${sport}::${normalize(category)}`) ? -1 : 1;
}
