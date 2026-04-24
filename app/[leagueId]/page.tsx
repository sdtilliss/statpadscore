'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import type { Score, PlayerStats, League, Message } from '@/lib/types';
import { computePlayerStats } from '@/lib/stats';

const SPORT_COLORS: Record<string, string> = {
  MLB: '#C4952A', NFL: '#3B6BB5', NBA: '#C84B31', NHL: '#4A90D9',
};
const SPORT_BG: Record<string, string> = {
  MLB: 'rgba(196,149,42,0.12)', NFL: 'rgba(59,107,181,0.15)',
  NBA: 'rgba(200,75,49,0.12)', NHL: 'rgba(74,144,217,0.12)',
};
function sportColor(sport: string) { return SPORT_COLORS[sport] || '#888'; }
function sportBg(sport: string) { return SPORT_BG[sport] || 'rgba(136,136,136,0.1)'; }

function ScreenshotModal({ url, onClose }: { url: string; onClose: () => void }) {
  useEffect(() => {
    const fn = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [onClose]);
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 16, cursor: 'pointer',
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400, width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="Score screenshot" style={{ width: '100%', maxHeight: '75vh', objectFit: 'contain', borderRadius: 12, display: 'block' }} />
        <button onClick={onClose} style={{
          background: '#222', border: 'none', color: '#fff',
          fontSize: 14, fontWeight: 600, cursor: 'pointer', borderRadius: 10,
          padding: '12px', width: '100%',
        }}>Close</button>
      </div>
    </div>
  );
}

function ScoreRow({ score, rank }: { score: Score; rank: number }) {
  const [open, setOpen] = useState(false);
  const medal = ['🥇', '🥈', '🥉'][rank - 1];
  return (
    <>
      <div onClick={() => setOpen(true)} style={{
        background: sportBg(score.sport), border: `1px solid ${sportColor(score.sport)}35`,
        borderRadius: 10, padding: '11px 14px', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 12, transition: 'filter 0.15s',
      }}
        onMouseEnter={(e) => (e.currentTarget.style.filter = 'brightness(1.15)')}
        onMouseLeave={(e) => (e.currentTarget.style.filter = 'brightness(1)')}
      >
        <span style={{ fontSize: 17, minWidth: 22, textAlign: 'center' }}>
          {medal ?? <span style={{ color: '#555', fontSize: 13 }}>{rank}</span>}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {score.playerName}
          </div>
          <div style={{ fontSize: 11, color: '#777', marginTop: 1 }}>
            {score.totalGuesses} guesses
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontWeight: 800, fontSize: 20, color: sportColor(score.sport) }}>
            {score.totalScore.toLocaleString()}
          </div>
          <div style={{ fontSize: 11, color: '#666', marginTop: 1 }}>beat {score.percentile}%</div>
        </div>
        <span style={{ color: '#444', fontSize: 12, marginLeft: 2 }}>▸</span>
      </div>
      {open && <ScreenshotModal url={score.screenshotUrl} onClose={() => setOpen(false)} />}
    </>
  );
}

function TodayTab({ scores, leagueId }: { scores: Score[]; leagueId: string }) {
  if (scores.length === 0) {
    return (
      <div style={{ textAlign: 'center', color: '#444', padding: '56px 0', fontSize: 14 }}>
        No scores yet today.<br />
        <a href={`/${leagueId}/submit`} style={{ color: '#1db954', textDecoration: 'none', marginTop: 8, display: 'inline-block' }}>
          Be the first to submit!
        </a>
      </div>
    );
  }
  const sports = [...new Set(scores.map((s) => s.sport))].sort();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      {sports.map((sport) => {
        const sportScores = scores.filter((s) => s.sport === sport).sort((a, b) => b.percentile - a.percentile);
        return (
          <div key={sport}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ background: sportColor(sport), color: '#fff', fontSize: 10, fontWeight: 800, padding: '3px 10px', borderRadius: 20, letterSpacing: 1 }}>{sport}</span>
              <span style={{ fontSize: 12, color: '#555' }}>{sportScores[0].category}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {sportScores.map((s, i) => <ScoreRow key={s.id} score={s} rank={i + 1} />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StatsTab({ stats }: { stats: PlayerStats[] }) {
  const allSports = [...new Set(stats.flatMap((p) => Object.keys(p.sportBreakdown)))].sort();
  const [activeSport, setActiveSport] = useState('');
  const sport = activeSport && allSports.includes(activeSport) ? activeSport : allSports[0];

  if (stats.length === 0 || allSports.length === 0) {
    return <div style={{ textAlign: 'center', color: '#444', padding: '56px 0', fontSize: 14 }}>No data yet.</div>;
  }

  const sportRanking = stats
    .filter((p) => p.sportBreakdown[sport])
    .map((p) => ({ ...p, sd: p.sportBreakdown[sport] }))
    .sort((a, b) => b.sd.avgPercentile - a.sd.avgPercentile);

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, overflowX: 'auto', paddingBottom: 2 }}>
        {allSports.map((s) => (
          <button key={s} onClick={() => setActiveSport(s)} style={{
            background: sport === s ? sportColor(s) : '#1a1a1a',
            color: sport === s ? '#fff' : '#666',
            border: `1px solid ${sport === s ? sportColor(s) : '#2a2a2a'}`,
            borderRadius: 20, padding: '6px 16px', fontSize: 12, fontWeight: 700,
            cursor: 'pointer', letterSpacing: 0.5, whiteSpace: 'nowrap', transition: 'all 0.15s',
          }}>{s}</button>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {sportRanking.map((p, i) => {
          const medal = ['🥇', '🥈', '🥉'][i];
          return (
            <div key={p.playerName} style={{
              background: sportBg(sport), border: `1px solid ${sportColor(sport)}30`,
              borderRadius: 10, padding: '13px 14px', display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <span style={{ fontSize: 17, minWidth: 22, textAlign: 'center' }}>
                {medal ?? <span style={{ color: '#555', fontSize: 13 }}>{i + 1}</span>}
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#fff' }}>{p.playerName}</div>
                <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
                  {p.sd.count} game{p.sd.count !== 1 ? 's' : ''}
                  {p.sd.purpleHits > 0 && <span style={{ color: '#a855f7', marginLeft: 8 }}>💜 {p.sd.purpleHits} purple</span>}
                  {p.currentStreak > 1 && <span style={{ color: '#f5a623', marginLeft: 8 }}>🔥 {p.currentStreak}d streak</span>}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 800, fontSize: 18, color: sportColor(sport) }}>{p.sd.avgPercentile}%</div>
                <div style={{ fontSize: 10, color: '#555' }}>avg percentile</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ChatTab({ leagueId }: { leagueId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('statpad_name');
    if (saved) setName(saved);
  }, []);

  const loadMessages = useCallback(async () => {
    const res = await fetch(`/api/messages?leagueId=${leagueId}`);
    if (res.ok) setMessages(await res.json());
  }, [leagueId]);

  useEffect(() => { loadMessages(); }, [loadMessages]);

  // Scroll to bottom when messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !text.trim() || sending) return;
    setSending(true);
    setError('');
    localStorage.setItem('statpad_name', name.trim());
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leagueId, playerName: name.trim(), text: text.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send');
      setText('');
      await loadMessages();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSending(false);
    }
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Message list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 120, marginBottom: 20 }}>
        {messages.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#444', padding: '40px 0', fontSize: 14 }}>
            No messages today. Say something! 👋
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} style={{
              background: '#141414', border: '1px solid #1e1e1e',
              borderRadius: 10, padding: '10px 14px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: '#fff' }}>{m.playerName}</span>
                <span style={{ fontSize: 11, color: '#444' }}>{formatTime(m.sentAt)}</span>
              </div>
              <div style={{ fontSize: 14, color: '#ccc', lineHeight: 1.45, wordBreak: 'break-word' }}>{m.text}</div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Compose */}
      <form onSubmit={send} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <input
          type="text" value={name} onChange={(e) => setName(e.target.value)}
          placeholder="Your name" required
          style={{
            background: '#141414', border: '1px solid #2a2a2a', borderRadius: 10,
            padding: '11px 14px', fontSize: 14, color: '#fff', outline: 'none',
          }}
        />
        <div style={{ display: 'flex', gap: 8 }}>
          <textarea
            value={text} onChange={(e) => setText(e.target.value)}
            placeholder="Say something…" required maxLength={500}
            rows={2}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(e as unknown as React.FormEvent); }
            }}
            style={{
              flex: 1, background: '#141414', border: '1px solid #2a2a2a', borderRadius: 10,
              padding: '11px 14px', fontSize: 14, color: '#fff', outline: 'none',
              resize: 'none', fontFamily: 'inherit',
            }}
          />
          <button type="submit" disabled={!name.trim() || !text.trim() || sending} style={{
            background: name.trim() && text.trim() ? '#1db954' : '#1a1a1a',
            color: name.trim() && text.trim() ? '#fff' : '#444',
            border: 'none', borderRadius: 10, padding: '0 18px',
            fontSize: 20, cursor: name.trim() && text.trim() ? 'pointer' : 'default',
            transition: 'background 0.15s, color 0.15s', alignSelf: 'stretch',
          }}>↑</button>
        </div>
        {error && (
          <div style={{ fontSize: 12, color: '#e07060' }}>{error}</div>
        )}
        <div style={{ fontSize: 11, color: '#333', textAlign: 'right' }}>{text.length}/500 · resets at 4am PST</div>
      </form>
    </div>
  );
}

export default function LeaguePage() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const [tab, setTab] = useState<'today' | 'stats' | 'chat'>('today');
  const [league, setLeague] = useState<League | null>(null);
  const [todayScores, setTodayScores] = useState<Score[]>([]);
  const [allTimeStats, setAllTimeStats] = useState<PlayerStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [viewDate, setViewDate] = useState<string>('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [leagueRes, datesRes, allRes] = await Promise.all([
        fetch(`/api/league?id=${leagueId}`),
        fetch(`/api/scores?leagueId=${leagueId}&mode=dates`),
        fetch(`/api/scores?leagueId=${leagueId}&mode=alltime`),
      ]);
      if (leagueRes.status === 404) { setNotFound(true); setLoading(false); return; }
      setLeague(await leagueRes.json());
      const dates: string[] = await datesRes.json();
      setAvailableDates(dates);
      const latestDate = dates[0] || '';
      setViewDate(latestDate);
      if (latestDate) {
        const scoresRes = await fetch(`/api/scores?leagueId=${leagueId}&date=${latestDate}`);
        setTodayScores(await scoresRes.json());
      }
      setAllTimeStats(computePlayerStats(await allRes.json()));
    } finally {
      setLoading(false);
    }
  }, [leagueId]);

  const loadScoresForDate = useCallback(async (date: string) => {
    const res = await fetch(`/api/scores?leagueId=${leagueId}&date=${date}`);
    setTodayScores(await res.json());
  }, [leagueId]);

  useEffect(() => { loadData(); }, [loadData]);

  // Remember this league so the homepage can redirect back to it
  useEffect(() => {
    localStorage.setItem('statpad_last_league', leagueId);
  }, [leagueId]);

  function copyInvite() {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  if (notFound) return (
    <main style={{
      minHeight: '100vh', background: '#0d0d0d', color: '#fff',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16,
    }}>
      <div style={{ fontSize: 14, color: '#555' }}>League not found.</div>
      <a href="/" style={{ color: '#1db954', fontSize: 14, textDecoration: 'none' }}>← Create a new league</a>
    </main>
  );

  return (
    <main style={{
      minHeight: '100vh', background: '#0d0d0d', color: '#fff',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      maxWidth: 480, margin: '0 auto', padding: '0 0 80px',
    }}>
      <div style={{ padding: '24px 16px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 11, color: '#555', letterSpacing: 0.5 }}>statpadscore</div>
            <h1 style={{ fontSize: 20, fontWeight: 900, margin: '2px 0 0', letterSpacing: -0.5 }}>
              {loading ? '...' : league?.name}
            </h1>
            <div style={{ fontSize: 12, color: '#444', marginTop: 2 }}>{today}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
            <a href={`/${leagueId}/submit`} style={{
              background: '#1db954', color: '#fff', padding: '9px 18px',
              borderRadius: 24, textDecoration: 'none', fontWeight: 700, fontSize: 13,
            }}>+ Submit</a>
            <button onClick={copyInvite} style={{
              background: 'none', border: '1px solid #2a2a2a', color: copied ? '#1db954' : '#555',
              padding: '5px 12px', borderRadius: 24, fontSize: 11, cursor: 'pointer',
              transition: 'color 0.15s',
            }}>
              {copied ? '✓ Copied!' : '⎘ Invite link'}
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', marginTop: 24, borderBottom: '1px solid #1a1a1a' }}>
          {(['today', 'stats', 'chat'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: tab === t ? '#fff' : '#444',
              fontWeight: tab === t ? 700 : 400,
              fontSize: 13, padding: '10px 18px',
              borderBottom: tab === t ? '2px solid #fff' : '2px solid transparent',
            }}>
              {t === 'today' ? "Today's Scores" : t === 'stats' ? 'All-Time Stats' : '💬 Chat'}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: '20px 16px 0' }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: '#333', padding: '56px 0', fontSize: 14 }}>Loading...</div>
        ) : tab === 'today' ? (
          <>
            {availableDates.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <button
                  onClick={() => {
                    const idx = availableDates.indexOf(viewDate);
                    if (idx < availableDates.length - 1) {
                      const d = availableDates[idx + 1];
                      setViewDate(d);
                      loadScoresForDate(d);
                    }
                  }}
                  disabled={availableDates.indexOf(viewDate) >= availableDates.length - 1}
                  style={{ background: 'none', border: 'none', color: availableDates.indexOf(viewDate) >= availableDates.length - 1 ? '#2a2a2a' : '#666', fontSize: 20, cursor: availableDates.indexOf(viewDate) >= availableDates.length - 1 ? 'default' : 'pointer', padding: '4px 8px' }}
                >‹</button>
                <span style={{ fontSize: 13, color: viewDate === availableDates[0] ? '#1db954' : '#888', fontWeight: 600 }}>
                  {viewDate === availableDates[0]
                    ? 'Today'
                    : new Date(viewDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </span>
                <button
                  onClick={() => {
                    const idx = availableDates.indexOf(viewDate);
                    if (idx > 0) {
                      const d = availableDates[idx - 1];
                      setViewDate(d);
                      loadScoresForDate(d);
                    }
                  }}
                  disabled={availableDates.indexOf(viewDate) <= 0}
                  style={{ background: 'none', border: 'none', color: availableDates.indexOf(viewDate) <= 0 ? '#2a2a2a' : '#666', fontSize: 20, cursor: availableDates.indexOf(viewDate) <= 0 ? 'default' : 'pointer', padding: '4px 8px' }}
                >›</button>
              </div>
            )}
            <TodayTab scores={todayScores} leagueId={leagueId} />
          </>
        ) : tab === 'stats' ? (
          <StatsTab stats={allTimeStats} />
        ) : (
          <ChatTab leagueId={leagueId} />
        )}
      </div>
    </main>
  );
}
