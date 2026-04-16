import { NextRequest, NextResponse } from 'next/server';
import { createLeague, getLeague, getAllLeagues } from '@/lib/kv';

function generateId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from(crypto.getRandomValues(new Uint8Array(6)))
    .map((b) => chars[b % chars.length])
    .join('');
}

export async function POST(req: NextRequest) {
  const { name } = await req.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: 'League name is required.' }, { status: 400 });
  }
  const id = generateId();
  const league = { id, name: name.trim(), createdAt: new Date().toISOString() };
  await createLeague(league);
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
