import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { put } from '@vercel/blob';
import { saveScore } from '@/lib/kv';
import { getStatpadDate, resolveStatpadDate } from '@/lib/date';
import { normalizeSport } from '@/lib/sports';
import { checkLimit, getIp, submitLimiter } from '@/lib/ratelimit';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export async function POST(req: NextRequest) {
  try {
    const rl = await checkLimit(submitLimiter, getIp(req));
    if (!rl.success) {
      const retry = Math.max(1, Math.ceil((rl.reset - Date.now()) / 1000));
      return NextResponse.json(
        { error: 'Too many submissions. Please slow down and try again later.' },
        { status: 429, headers: { 'Retry-After': String(retry) } },
      );
    }

    const formData = await req.formData();
    const file = formData.get('screenshot') as File | null;
    const playerName = (formData.get('playerName') as string | null)?.trim();
    const leagueId = (formData.get('leagueId') as string | null)?.trim();

    if (!file || !playerName || !leagueId) {
      return NextResponse.json({ error: 'Missing screenshot, player name, or league.' }, { status: 400 });
    }

    if (!ALLOWED_MIME.has(file.type)) {
      return NextResponse.json({ error: 'Unsupported image type. Use JPEG, PNG, WebP, or GIF.' }, { status: 415 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'Screenshot is too large (max 5MB).' }, { status: 413 });
    }

    // Upload screenshot to Vercel Blob (use a UUID prefix so weird filenames can't break the path)
    const blob = await put(`screenshots/${crypto.randomUUID()}`, file, { access: 'public', contentType: file.type });

    // Convert to base64 for Claude
    const buffer = await file.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    const mediaType = (file.type || 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
            {
              type: 'text',
              text: `Extract data from this Statpad game screenshot. There are two dropdowns at the top-right: a DATE dropdown on the left and a SPORT dropdown on the right. Return ONLY a JSON object with these fields:
{
  "date": the text in the DATE dropdown (the left one at the top-right). It is either the word "Today" or a short month/day date like "7/18". Return it exactly as shown,
  "sport": the sport for this game as one of exactly these four codes: "MLB", "NFL", "NBA", or "NHL". First read it from the SPORT dropdown (the right one at the top-right). If that dropdown is cropped off or not visible, INFER the sport from the team logos, athletes, and stat category shown (baseball players or batting/pitching stats like HR, SO, WAR, ERA = MLB; basketball = NBA; football = NFL; hockey = NHL). Always return one of the four codes — never "Unknown", "Not visible", or any other value,
  "category": the stat category shown top-left (e.g. "WAR", "FPTS", "3PM", "HR"),
  "totalScore": the main score value — look for a label like "TOTAL SCORE", "AVERAGE SCORE", or similar, and if no clear label use the large prominent number in the center of the screen. Preserve exactly as shown including decimals (e.g. 0.900 not 900, 21.6 not 216),
  "totalGuesses": the number labeled "TOTAL GUESSES" (as a number),
  "percentile": the number X from "YOUR GRID BEAT X% OF OTHER SCORES" (as a number, e.g. 41.3),
  "purpleTiles": the count of individual athlete rows that show 100th percentile — these tiles have a distinct purple/violet background compared to gold or gray tiles. Count only rows showing exactly "100th PERCENTILE". Return 0 if none.
}
Return only the JSON, no markdown or explanation.`,
            },
          ],
        },
      ],
    });

    const text = message.content[0].type === 'text' ? message.content[0].text.trim() : '';
    let parsed: { date?: string; sport: string; category: string; totalScore: number; totalGuesses: number; percentile: number; purpleTiles: number };
    try {
      // Strip markdown code fences if Claude wrapped the response
      let jsonText = text;
      const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (fenceMatch) jsonText = fenceMatch[1].trim();
      // Extract JSON object in case there's surrounding text
      const objMatch = jsonText.match(/\{[\s\S]*\}/);
      if (objMatch) jsonText = objMatch[0];
      parsed = JSON.parse(jsonText);
    } catch {
      console.error('Claude response was:', text);
      return NextResponse.json({ error: 'Could not read scores from screenshot. Please try again.' }, { status: 422 });
    }

    // Read the date from the screenshot's dropdown ("Today" or e.g. "7/18") so a
    // backfilled score files under its real day. Anything unrecognized or out of
    // range falls back to the current Statpad day.
    const date = resolveStatpadDate(parsed.date) ?? getStatpadDate();

    // Never save a garbage sport. If the dropdown was cropped and Claude
    // couldn't infer a real sport from the tiles, ask for a fuller screenshot
    // rather than filing the score under "Unknown".
    const sport = normalizeSport(parsed.sport);
    if (!sport) {
      return NextResponse.json(
        { error: "Couldn't read the sport from your screenshot. Make sure the sport selector at the top of the screen is visible, then try again." },
        { status: 422 },
      );
    }

    const score = {
      id: crypto.randomUUID(),
      leagueId,
      playerName,
      sport,
      category: parsed.category,
      totalScore: Number(parsed.totalScore),
      totalGuesses: Number(parsed.totalGuesses),
      percentile: Number(parsed.percentile),
      purpleTiles: Number(parsed.purpleTiles) || 0,
      date,
      screenshotUrl: blob.url,
      submittedAt: new Date().toISOString(),
    };

    await saveScore(score);
    return NextResponse.json({ success: true, score });
  } catch (err) {
    console.error('Submit error:', err);
    return NextResponse.json({ error: 'Server error. Please try again.' }, { status: 500 });
  }
}
