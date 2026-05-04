import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { createLeague, getLeague, getAllLeagues } from '@/lib/kv';
import { checkLimit, getIp, leagueLimiter } from '@/lib/ratelimit';
import { notifyNewLeague } from '@/lib/notify';

function generateId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from(crypto.getRandomValues(new Uint8Array(6)))
    .map((b) => chars[b % chars.length])
    .join('');
}

export async function POST(req: NextRequest) {
  const rl = await checkLimit(leagueLimiter, getIp(req));
  if (!rl.success) {
    const retry = Math.max(1, Math.ceil((rl.reset - Date.now()) / 1000));
    return NextResponse.json(
      { error: 'Too many leagues created. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(retry) } },
    );
  }

  const { name } = await req.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: 'League name is required.' }, { status: 400 });
  }
  const id = generateId();
  const league = { id, name: name.trim(), createdAt: new Date().toISOString() };
  await createLeague(league);

  // Fire admin notification after the response goes out so league creation
  // never waits on Resend, and a Resend hiccup can never break the user flow.
  after(() => notifyNewLeague(league, getIp(req)));

  return NextResponse.json(league);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  const all = searchParams.get('all');

  if (all === '1') {
    const leagues = await getAllLeagues();
    return NextResponse.json(leagues);
  }

  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  const league = await getLeague(id);
  if (!league) return NextResponse.json({ error: 'League not found' }, { status: 404 });
  return NextResponse.json(league);
}
