// Seed a synthetic league into Redis so the stats views can be tested without
// running the screenshot-submit pipeline. Safe to re-run (overwrites the same
// league). Run with:  npx tsx scripts/seed-test-league.ts
//
// Deliberately includes the win-logic edge cases:
//  - an exact tie at the top of a sport (both players should be credited a win)
//  - a solo-submitter day (uncontested win)
//  - players with different placement profiles
import { readFileSync } from 'fs';
import { join } from 'path';
import { Redis } from '@upstash/redis';
import type { League, Score, TripleCrown } from '../lib/types';
import { evaluateTripleCrown } from '../lib/triplecrowns';

// Minimal .env.local parser — tsx doesn't auto-load Next's env files.
const env: Record<string, string> = {};
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)="?([^"\n]*)"?$/);
  if (m) env[m[1]] = m[2];
}

const kv = new Redis({ url: env.KV_REST_API_URL, token: env.KV_REST_API_TOKEN });

const LEAGUE_ID = 'test-league';
const PLAYERS = ['Will', 'Seth', 'Mars', 'Jules', 'Dana'];
// Ben only played during the older stretch — he should appear in All-Time and
// All Stats but not in recent months, exercising the month filter.
const RETIRED_PLAYER = 'Ben';
const RETIRED_ACTIVE_FROM_DAYS_AGO = 40;
const SPORTS = ['MLB', 'NFL', 'NBA'] as const;
const CATEGORIES: Record<string, string> = {
  MLB: 'Career Home Runs', NFL: 'Passing Yards 2023', NBA: 'Career Assists',
};

// Same 3am-PT day boundary as lib/date.ts
function statpadDate(offsetDays = 0): string {
  const shifted = new Date(Date.now() - 3 * 60 * 60 * 1000 - offsetDays * 24 * 60 * 60 * 1000);
  return shifted.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
}

// Deterministic pseudo-random so re-runs produce identical data.
let rngState = 42;
function rng(): number {
  rngState = (rngState * 1103515245 + 12345) % 2 ** 31;
  return rngState / 2 ** 31;
}

let idCounter = 0;
function mkScore(playerName: string, sport: string, date: string, percentile: number, totalScore: number, purpleTiles = 0): Score {
  return {
    id: `seed-${++idCounter}`,
    leagueId: LEAGUE_ID,
    playerName,
    sport,
    category: CATEGORIES[sport],
    totalScore,
    totalGuesses: 5,
    percentile,
    date,
    screenshotUrl: 'https://placehold.co/400x800/111/1db954/png?text=Seeded+test+score',
    submittedAt: new Date().toISOString(),
    ...(purpleTiles > 0 ? { purpleTiles } : {}),
  };
}

async function main() {
  const DAYS = 75;
  const league: League = { id: LEAGUE_ID, name: 'Test League (seeded)', createdAt: new Date().toISOString() };
  await kv.set(`league:${LEAGUE_ID}`, league);

  const dates: string[] = [];
  for (let d = DAYS - 1; d >= 0; d--) {
    const date = statpadDate(d);
    dates.push(date);
    const scores: Score[] = [];

    if (d === 5) {
      // Edge case 1: solo-submitter day — only Dana plays NFL, nobody else plays anything.
      scores.push(mkScore('Dana', 'NFL', date, 61, 3100));
    } else if (d === 1) {
      // Edge case 3: a guaranteed triple crown — all 5 players complete all 3
      // sports (satisfies the ≥4 complete-players gate) and Will tops every one.
      for (const sport of SPORTS) {
        scores.push(mkScore('Will', sport, date, 98, 4700, sport === 'NBA' ? 1 : 0));
        for (const p of PLAYERS.filter((x) => x !== 'Will')) {
          const percentile = Math.min(94, Math.max(20, Math.round(60 + (rng() - 0.5) * 50)));
          scores.push(mkScore(p, sport, date, percentile, 2000 + Math.round(rng() * 2500)));
        }
      }
    } else {
      const roster = d >= RETIRED_ACTIVE_FROM_DAYS_AGO ? [...PLAYERS, RETIRED_PLAYER] : PLAYERS;
      for (const sport of SPORTS) {
        // Rotate who skips, so games-played counts differ.
        const skip = roster[(d + sport.length) % roster.length];
        for (const p of roster) {
          if (p === skip && rng() < 0.7) continue;
          // Skill profiles: Will strong, Seth streaky, others mid.
          const base = p === 'Will' ? 78 : p === 'Seth' ? 70 : p === 'Mars' ? 62 : p === 'Jules' ? 55 : p === 'Ben' ? 66 : 48;
          const percentile = Math.min(99, Math.max(5, Math.round(base + (rng() - 0.5) * 40)));
          const totalScore = 2000 + Math.round(rng() * 3000);
          const purple = rng() > 0.92 ? 1 : 0;
          scores.push(mkScore(p, sport, date, percentile, totalScore, purple));
        }
      }
      if (d === 2) {
        // Edge case 2: exact tie at the top of NBA — Will & Seth, same percentile AND score.
        const filtered = scores.filter((s) => !(s.sport === 'NBA' && (s.playerName === 'Will' || s.playerName === 'Seth')));
        scores.length = 0;
        scores.push(...filtered, mkScore('Will', 'NBA', date, 97, 4800), mkScore('Seth', 'NBA', date, 97, 4800));
      }
    }
    await kv.set(`scores:${LEAGUE_ID}:${date}`, scores);
    console.log(`${date}: ${scores.length} scores`);
  }

  await kv.set(`dates:${LEAGUE_ID}`, [...dates].sort().reverse());

  // Backfill triple crowns over the seeded history — the same evaluation the
  // daily cron runs, so the Crowns tab behaves exactly as it would in prod.
  const crowns: TripleCrown[] = [];
  for (const date of dates) {
    const dayScores = (await kv.get<Score[]>(`scores:${LEAGUE_ID}:${date}`)) || [];
    const winner = evaluateTripleCrown(dayScores);
    if (winner) crowns.push({ leagueId: LEAGUE_ID, date, playerName: winner });
  }
  await kv.set(`triplecrowns:${LEAGUE_ID}`, crowns);
  console.log(`Crowns: ${crowns.map((c) => `${c.date} → ${c.playerName}`).join(', ') || 'none'}`);

  console.log(`\nSeeded league "${league.name}" → /${LEAGUE_ID} (${DAYS} days, ${idCounter} scores)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
