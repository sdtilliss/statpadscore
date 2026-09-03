// Read-only audit: for each sport+category, figure out whether a higher raw
// score means "better" (agrees with Statpad's percentile) or "worse" (e.g.
// ERA, WHIP — lower is better) using pairwise concordance against Statpad's
// own percentile as ground truth, computed over ALL history.
//
// Background: Statpad ranks by `percentile`, which is a live global number
// that drifts through the day — so a lower raw score occasionally "wins" a
// triple crown. The fix: within a single (day, sport), rank by raw score
// instead (everyone played the identical grid, so it's directly comparable).
// That requires knowing, per category, which direction is "better" — this
// script derives that from the data rather than an LLM or a hand-maintained
// list. See memory `score-direction-ranking` for the full design.
//
// Deliberately scans `scores:*` directly rather than going through
// `dates:{league}`, which is capped at the most recent 365 entries and would
// hide older history.
//
// Run:  npx tsx scripts/direction-audit.ts
import { readFileSync } from 'fs';
import { join } from 'path';
import { Redis } from '@upstash/redis';
import type { Score } from '../lib/types';

// Synthetic data from scripts/seed-test-league.ts — totalScore and percentile
// are generated independently there, so it's pure noise for this analysis.
const EXCLUDED_LEAGUES = new Set(['test-league']);

// Minimal .env.local parser — tsx doesn't auto-load Next's env files.
const env: Record<string, string> = {};
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)="?([^"\n]*)"?$/);
  if (m) env[m[1]] = m[2];
}

// The read-only token lacks permission for KEYS, so this uses the full
// token — the script itself never calls a write method (set/del/etc).
const kv = new Redis({ url: env.KV_REST_API_URL, token: env.KV_REST_API_TOKEN });

const MAGNITUDE_FRACTION = 0.1; // ignore pairs closer than 10% of the category's p10-p90 spread
const MIN_QUALIFYING_PAIRS = 30;
const MIN_AGREEMENT = 0.7;

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

// Linear-interpolated percentile over a pre-sorted array.
function pctl(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function levenshtein(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

interface Group {
  sport: string;
  category: string; // most common raw label, for display
  labelCounts: Map<string, number>;
  scores: Score[];
}

async function main() {
  console.log('Scanning scores:* across all leagues (full history, not capped by the dates index)...\n');
  const allKeys = await kv.keys('scores:*');
  const keys = allKeys.filter((k) => !EXCLUDED_LEAGUES.has(k.split(':')[1]));
  console.log(`Found ${allKeys.length} score-day keys (${allKeys.length - keys.length} excluded as seeded/test data).`);

  const all: Score[] = [];
  const CHUNK = 200;
  for (let i = 0; i < keys.length; i += CHUNK) {
    const chunk = keys.slice(i, i + CHUNK);
    if (chunk.length === 0) continue;
    const values = await kv.mget<(Score[] | null)[]>(...chunk);
    for (const v of values) if (v) all.push(...v);
  }
  console.log(`Loaded ${all.length} total scores.\n`);

  if (all.length === 0) {
    console.log('No scores found — nothing to audit.');
    return;
  }

  // Group by sport + normalized category label.
  const groups = new Map<string, Group>();
  for (const s of all) {
    const key = `${s.sport}::${normalize(s.category)}`;
    let g = groups.get(key);
    if (!g) {
      g = { sport: s.sport, category: s.category, labelCounts: new Map(), scores: [] };
      groups.set(key, g);
    }
    g.labelCounts.set(s.category, (g.labelCounts.get(s.category) || 0) + 1);
    if (g.labelCounts.get(s.category)! > (g.labelCounts.get(g.category) || 0)) g.category = s.category;
    g.scores.push(s);
  }

  // Flag near-duplicate normalized labels within the same sport — should be
  // checked before trusting the groupings above (a real split vs. a typo).
  // Edit distance alone is useless on short abbreviation-style codes ("so"
  // vs "era" is distance 3 but unrelated), so require it to be small
  // *relative to* the longer label's length, and skip labels under 4 chars
  // entirely (too short for edit distance or substring checks to mean
  // anything — e.g. "g" is a substring of "pitching").
  console.log('=== Possible near-duplicate category labels (same sport) ===');
  const labelKeys = [...groups.keys()];
  let dupFound = false;
  for (let i = 0; i < labelKeys.length; i++) {
    for (let j = i + 1; j < labelKeys.length; j++) {
      const [sportA, normA] = labelKeys[i].split('::');
      const [sportB, normB] = labelKeys[j].split('::');
      if (sportA !== sportB || normA === normB) continue;
      if (normA.length < 4 || normB.length < 4) continue;
      const dist = levenshtein(normA, normB);
      const ratio = dist / Math.max(normA.length, normB.length);
      const substring = normA.includes(normB) || normB.includes(normA);
      if (ratio <= 0.3 || substring) {
        dupFound = true;
        console.log(`  [${sportA}] "${normA}"  vs  "${normB}"  (edit distance ${dist}${substring ? ', substring' : ''})`);
      }
    }
  }
  if (!dupFound) console.log('  none found');
  console.log();

  console.log('=== Direction verdicts (sport: category) ===\n');
  const directionMap: Record<string, 1 | -1> = {};
  const rows: {
    key: string; sport: string; category: string; n: number;
    qualifyingPairs: number; agreementPct: number; verdict: string;
  }[] = [];

  for (const [key, g] of groups) {
    const scores = g.scores;
    const totalsSorted = scores.map((s) => s.totalScore).sort((a, b) => a - b);
    const p10 = pctl(totalsSorted, 0.1);
    const p90 = pctl(totalsSorted, 0.9);
    const threshold = (p90 - p10) * MAGNITUDE_FRACTION;

    // Only compare pairs from the SAME day: that's the only case where raw
    // score is guaranteed apples-to-apples (identical grid). Pooling across
    // different days conflates real skill gaps with day-to-day shifts in the
    // achievable range (e.g. "Career Home Runs" pulls from a different set
    // of eligible players each day), which is pure noise for this test.
    const byDate = new Map<string, Score[]>();
    for (const s of scores) {
      const arr = byDate.get(s.date);
      if (arr) arr.push(s);
      else byDate.set(s.date, [s]);
    }

    let concordant = 0;
    let discordant = 0;
    for (const dayScores of byDate.values()) {
      for (let i = 0; i < dayScores.length; i++) {
        for (let j = i + 1; j < dayScores.length; j++) {
          const a = dayScores[i];
          const b = dayScores[j];
          const scoreDiff = a.totalScore - b.totalScore;
          if (Math.abs(scoreDiff) <= threshold) continue; // magnitude gate
          const pctDiff = a.percentile - b.percentile;
          if (pctDiff === 0) continue; // no signal either way
          if (Math.sign(scoreDiff) === Math.sign(pctDiff)) concordant++;
          else discordant++;
        }
      }
    }
    const qualifying = concordant + discordant;
    const positiveRate = qualifying > 0 ? concordant / qualifying : 0.5;
    const agreement = Math.max(positiveRate, 1 - positiveRate);
    const sign: 1 | -1 = positiveRate >= 0.5 ? 1 : -1;

    let verdict: string;
    if (qualifying < MIN_QUALIFYING_PAIRS || agreement < MIN_AGREEMENT) {
      verdict = 'ABSTAIN (fall back to percentile)';
    } else {
      verdict = sign === 1 ? 'higher = better  (+1)' : 'lower = better  (-1)';
      directionMap[key] = sign;
    }

    rows.push({
      key, sport: g.sport, category: g.category, n: scores.length,
      qualifyingPairs: qualifying, agreementPct: Math.round(agreement * 1000) / 10, verdict,
    });
  }

  rows.sort((a, b) => b.n - a.n);
  for (const r of rows) {
    console.log(`[${r.sport}] ${r.category}  (n=${r.n}, qualifying pairs=${r.qualifyingPairs}, agreement=${r.agreementPct}%)`);
    console.log(`  -> ${r.verdict}`);
    const g = groups.get(r.key)!;
    const byScore = g.scores.slice().sort((a, b) => a.totalScore - b.totalScore);
    const lo = byScore[0];
    const hi = byScore[byScore.length - 1];
    console.log(`  evidence: lowest raw ${lo.totalScore} -> ${lo.percentile}%ile  |  highest raw ${hi.totalScore} -> ${hi.percentile}%ile`);
  }

  console.log('\n=== Suggested static map (only categories with a confident verdict) ===');
  console.log(JSON.stringify(directionMap, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
