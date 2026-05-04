import { NextRequest, NextResponse } from 'next/server';
import { getMessages, saveMessage } from '@/lib/kv';
import { getStatpadDate } from '@/lib/date';
import { checkLimit, getIp, messageLimiter } from '@/lib/ratelimit';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const leagueId = searchParams.get('leagueId');
  if (!leagueId) return NextResponse.json({ error: 'Missing leagueId' }, { status: 400 });

  const messages = await getMessages(leagueId);
  return NextResponse.json(messages);
}

export async function POST(req: NextRequest) {
  try {
    const rl = await checkLimit(messageLimiter, getIp(req));
    if (!rl.success) {
      const retry = Math.max(1, Math.ceil((rl.reset - Date.now()) / 1000));
      return NextResponse.json(
        { error: 'Slow down — too many messages.' },
        { status: 429, headers: { 'Retry-After': String(retry) } },
      );
    }

    const { leagueId, playerName, text } = await req.json();
    if (!leagueId || !playerName?.trim() || !text?.trim()) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }
    if (text.trim().length > 500) {
      return NextResponse.json({ error: 'Message too long (max 500 chars)' }, { status: 400 });
    }

    const message = {
      id: crypto.randomUUID(),
      leagueId,
      playerName: playerName.trim(),
      text: text.trim(),
      date: getStatpadDate(),
      sentAt: new Date().toISOString(),
    };

    await saveMessage(message);
    return NextResponse.json({ success: true, message });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
