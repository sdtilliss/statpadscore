import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/lib/admin';
import { deleteLeague } from '@/lib/kv';

export async function DELETE(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { leagueId } = await req.json().catch(() => ({}));
  if (!leagueId) return NextResponse.json({ error: 'Missing leagueId' }, { status: 400 });
  await deleteLeague(leagueId);
  return NextResponse.json({ success: true });
}
