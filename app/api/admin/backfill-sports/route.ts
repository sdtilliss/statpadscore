import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { isAdmin } from '@/lib/admin';
import { getAllLeagues, getAllDates, getScoresByDate, replaceScoresForDate } from '@/lib/kv';
import { normalizeSport } from '@/lib/sports';
import type { Score } from '@/lib/types';

// One-time cleanup for scores whose `sport` isn't one of MLB/NFL/NBA/NHL —
// e.g. "Unknown" / "Not visible in image" that leaked in before submit
// validation existed. For each bad row we first try a cheap normalize (fixes
// case/aliases with no API call); if it's genuinely unresolvable we re-run the
// vision model on the score's stored screenshot to infer the sport from the
// logos/players/stat category, then rewrite only the sport field.
//
// Admin-gated and idempotent (valid rows are skipped), so it's safe to re-run.
//
// Usage (while logged into /admin, so the cookie rides along):
//   /api/admin/backfill-sports?dryRun=1              -> preview all leagues, writes nothing
//   /api/admin/backfill-sports?leagueId=xxx&dryRun=1 -> preview one league
//   /api/admin/backfill-sports                       -> fix all leagues
//   /api/admin/backfill-sports?leagueId=xxx          -> fix one league

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

type AnthropicMediaType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';

function toMediaType(contentType: string | null): AnthropicMediaType {
  const t = (contentType || '').split(';')[0].trim().toLowerCase();
  if (t === 'image/png' || t === 'image/webp' || t === 'image/gif') return t;
  return 'image/jpeg';
}

// Re-infer the sport from a stored screenshot. Returns a canonical code or null
// if it still can't be determined (leave the row alone in that case).
async function reparseSport(screenshotUrl: string): Promise<string | null> {
  const res = await fetch(screenshotUrl);
  if (!res.ok) return null;
  const buffer = await res.arrayBuffer();
  const base64 = Buffer.from(buffer).toString('base64');
  const mediaType = toMediaType(res.headers.get('content-type'));

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 16,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
          {
            type: 'text',
            text: `This is a screenshot from the Statpad sports game. Identify the sport as exactly one of these four codes: MLB, NFL, NBA, NHL. Read it from the SPORT dropdown at the top-right if visible; otherwise infer it from the team logos, athletes, and stat category shown (baseball players or batting/pitching stats like HR, SO, WAR, ERA = MLB; basketball = NBA; football = NFL; hockey = NHL). Respond with ONLY the code, nothing else.`,
          },
        ],
      },
    ],
  });

  const text = message.content[0]?.type === 'text' ? message.content[0].text : '';
  return normalizeSport(text);
}

interface Change {
  leagueId: string;
  date: string;
  scoreId: string;
  playerName: string;
  oldSport: string;
  newSport: string;
  method: 'normalize' | 'reparse';
}
interface Unresolved {
  leagueId: string;
  date: string;
  scoreId: string;
  playerName: string;
  oldSport: string;
}

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const dryRun = searchParams.get('dryRun') === '1';
  const oneLeague = searchParams.get('leagueId');
  const leagueIds = oneLeague ? [oneLeague] : (await getAllLeagues()).map((l) => l.id);

  const changes: Change[] = [];
  const unresolved: Unresolved[] = [];
  let scoresScanned = 0;

  for (const leagueId of leagueIds) {
    const dates = await getAllDates(leagueId);
    for (const date of dates) {
      const scores = await getScoresByDate(leagueId, date);
      let dirty = false;

      for (const s of scores) {
        scoresScanned++;
        // Already a valid, canonical sport — nothing to do.
        if (normalizeSport(s.sport) === s.sport) continue;

        // Cheap path: fixable by case/alias without touching the model.
        const cheap = normalizeSport(s.sport);
        if (cheap) {
          changes.push({ leagueId, date, scoreId: s.id, playerName: s.playerName, oldSport: s.sport, newSport: cheap, method: 'normalize' });
          if (!dryRun) { s.sport = cheap; dirty = true; }
          continue;
        }

        // Genuinely unknown — re-parse from the stored screenshot.
        const reparsed = s.screenshotUrl ? await reparseSport(s.screenshotUrl) : null;
        if (reparsed) {
          changes.push({ leagueId, date, scoreId: s.id, playerName: s.playerName, oldSport: s.sport, newSport: reparsed, method: 'reparse' });
          if (!dryRun) { s.sport = reparsed; dirty = true; }
        } else {
          unresolved.push({ leagueId, date, scoreId: s.id, playerName: s.playerName, oldSport: s.sport });
        }
      }

      if (dirty) await replaceScoresForDate(leagueId, date, scores as Score[]);
    }
  }

  return NextResponse.json({
    dryRun,
    leaguesScanned: leagueIds.length,
    scoresScanned,
    fixedCount: changes.length,
    unresolvedCount: unresolved.length,
    fixed: changes,
    unresolved,
  });
}
