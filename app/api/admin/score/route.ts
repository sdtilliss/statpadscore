import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/lib/admin';
import { deleteScore } from '@/lib/kv';

export async function DELETE(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { leagueId, date, scoreId } = await req.json().catch(() => ({}));
  if (!leagueId || !date || !scoreId) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }
  const ok = await deleteScore(leagueId, date, scoreId);
  if (!ok) return NextResponse.json({ error: 'Score not found' }, { status: 404 });
  return NextResponse.json({ success: true });
}
