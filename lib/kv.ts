import { Redis } from '@upstash/redis';
import type { Score, League, Message } from './types';

const kv = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

// --- Leagues ---

export async function createLeague(league: League): Promise<void> {
  await kv.set(`league:${league.id}`, league);
  const ids = (await kv.get<string[]>('league_ids')) || [];
  if (!ids.includes(league.id)) {
    await kv.set('league_ids', [...ids, league.id]);
  }
}

export async function getLeague(leagueId: string): Promise<League | null> {
  return await kv.get<League>(`league:${leagueId}`);
}

export async function getAllLeagues(): Promise<League[]> {
  // Scan for all league:* keys to catch leagues created before the index existed
  const keys = await kv.keys('league:*');
  const leagueKeys = keys.filter((k) => !k.includes(':') || k.split(':').length === 2); // exclude league:id:... style
  if (leagueKeys.length === 0) return [];
  const leagues = await Promise.all(leagueKeys.map((k) => kv.get<League>(k)));
  return (leagues.filter(Boolean) as League[]).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

// --- Scores ---

export async function saveScore(score: Score): Promise<void> {
  const dateKey = `scores:${score.leagueId}:${score.date}`;
  const existing = (await kv.get<Score[]>(dateKey)) || [];
  const filtered = existing.filter(
    (s) => !(s.playerName.toLowerCase() === score.playerName.toLowerCase() && s.sport === score.sport)
  );
  filtered.push(score);
  await kv.set(dateKey, filtered);

  const datesKey = `dates:${score.leagueId}`;
  const dates = (await kv.get<string[]>(datesKey)) || [];
  if (!dates.includes(score.date)) {
    dates.push(score.date);
    dates.sort().reverse();
    await kv.set(datesKey, dates.slice(0, 365));
  }
}

export async function getScoresByDate(leagueId: string, date: string): Promise<Score[]> {
  return (await kv.get<Score[]>(`scores:${leagueId}:${date}`)) || [];
}

export async function getAllDates(leagueId: string): Promise<string[]> {
  return (await kv.get<string[]>(`dates:${leagueId}`)) || [];
}

export async function getRecentScores(leagueId: string, days = 90): Promise<Score[]> {
  const dates = await getAllDates(leagueId);
  const recent = dates.slice(0, days);
  const sets = await Promise.all(recent.map((d) => getScoresByDate(leagueId, d)));
  return sets.flat();
}

// --- Messages ---

export async function saveMessage(message: Message): Promise<void> {
  const key = `messages:${message.leagueId}:${message.date}`;
  const existing = (await kv.get<Message[]>(key)) || [];
  existing.push(message);
  await kv.set(key, existing);
}

export async function getMessages(leagueId: string, date: string): Promise<Message[]> {
  return (await kv.get<Message[]>(`messages:${leagueId}:${date}`)) || [];
}
