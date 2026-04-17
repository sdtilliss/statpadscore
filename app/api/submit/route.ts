import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { put } from '@vercel/blob';
import { saveScore } from '@/lib/kv';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('screenshot') as File | null;
    const playerName = (formData.get('playerName') as string | null)?.trim();
    const leagueId = (formData.get('leagueId') as string | null)?.trim();

    if (!file || !playerName || !leagueId) {
      return NextResponse.json({ error: 'Missing screenshot, player name, or league.' }, { status: 400 });
    }

    // Upload screenshot to Vercel Blob
    const blob = await put(`screenshots/${Date.now()}-${file.name}`, file, { access: 'public' });

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
              text: `Extract data from this Statpad game screenshot. Return ONLY a JSON object with these fields:
{
  "sport": the sport shown in the top-right dropdown (e.g. "MLB", "NFL", "NBA", "NHL"),
  "category": the stat category shown top-left (e.g. "WAR", "FPTS", "3PM", "HR"),
  "totalScore": the score value labeled "TOTAL SCORE" or "AVERAGE SCORE" — preserve it exactly as shown, including decimals (e.g. 0.900 not 900, 21.6 not 216),
  "totalGuesses": the number labeled "TOTAL GUESSES" (as a number),
  "percentile": the number X from "YOUR GRID BEAT X% OF OTHER SCORES" (as a number, e.g. 41.3)
}
Return only the JSON, no markdown or explanation.`,
            },
          ],
        },
      ],
    });

    const text = message.content[0].type === 'text' ? message.content[0].text.trim() : '';
    let parsed: { sport: string; category: string; totalScore: number; totalGuesses: number; percentile: number };
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

    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    const score = {
      id: crypto.randomUUID(),
      leagueId,
      playerName,
      sport: parsed.sport,
      category: parsed.category,
      totalScore: Number(parsed.totalScore),
      totalGuesses: Number(parsed.totalGuesses),
      percentile: Number(parsed.percentile),
      date: today,
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
