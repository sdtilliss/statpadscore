'use client';

import { useEffect, useState, useCallback, useMemo, type CSSProperties, type ReactNode } from 'react';
import { useParams } from 'next/navigation';
import type { Score, League, TripleCrown } from '@/lib/types';
import { computePlayerStats, computeMonthlyTitles, aggregateMonthlyTitles } from '@/lib/stats';

const SPORT_COLORS: Record<string, string> = {
  MLB: '#C4952A', NFL: '#3B6BB5', NBA: '#C84B31', NHL: '#4A90D9',
};
const SPORT_BG: Record<string, string> = {
  MLB: 'rgba(196,149,42,0.12)', NFL: 'rgba(59,107,181,0.15)',
  NBA: 'rgba(200,75,49,0.12)', NHL: 'rgba(74,144,217,0.12)',
};
function sportColor(sport: string) { return SPORT_COLORS[sport] || '#888'; }
function sportBg(sport: string) { return SPORT_BG[sport] || 'rgba(136,136,136,0.1)'; }

function DatePickerPopover({
  availableDates, selected, todayStr, onSelect, onClose,
}: {
  availableDates: Set<string>;
  selected: string;
  todayStr: string;
  onSelect: (date: string) => void;
  onClose: () => void;
}) {
  const sorted = [...availableDates].sort();
  const earliest = sorted[0] ?? selected;
  const [eY, eM] = earliest.split('-').map(Number);
  const [tY, tM] = todayStr.split('-').map(Number);
  const [sY, sM] = selected.split('-').map(Number);
  const [viewYear, setViewYear] = useState(sY);
  const [viewMonth, setViewMonth] = useState(sM); // 1-12

  useEffect(() => {
    const fn = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [onClose]);

  // Build the cell grid for the visible month
  const firstWeekday = new Date(Date.UTC(viewYear, viewMonth - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(viewYear, viewMonth, 0)).getUTCDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${viewYear}-${String(viewMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }

  const canPrev = viewYear > eY || (viewYear === eY && viewMonth > eM);
  const canNext = viewYear < tY || (viewYear === tY && viewMonth < tM);
  function prev() {
    if (!canPrev) return;
    if (viewMonth === 1) { setViewYear(viewYear - 1); setViewMonth(12); } else setViewMonth(viewMonth - 1);
  }
  function next() {
    if (!canNext) return;
    if (viewMonth === 12) { setViewYear(viewYear + 1); setViewMonth(1); } else setViewMonth(viewMonth + 1);
  }
  const monthLabel = new Date(Date.UTC(viewYear, viewMonth - 1, 1))
    .toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: '#141414', border: '1px solid #2a2a2a', borderRadius: 14,
        padding: 16, maxWidth: 320, width: '100%',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <button onClick={prev} disabled={!canPrev} style={{
            background: 'none', border: 'none', color: canPrev ? '#888' : '#2a2a2a',
            fontSize: 22, cursor: canPrev ? 'pointer' : 'default', padding: '4px 10px', lineHeight: 1,
          }}>‹</button>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{monthLabel}</span>
          <button onClick={next} disabled={!canNext} style={{
            background: 'none', border: 'none', color: canNext ? '#888' : '#2a2a2a',
            fontSize: 22, cursor: canNext ? 'pointer' : 'default', padding: '4px 10px', lineHeight: 1,
          }}>›</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 6 }}>
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
            <div key={i} style={{ textAlign: 'center', fontSize: 10, color: '#444', fontWeight: 700, letterSpacing: 0.5 }}>{d}</div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
          {cells.map((date, i) => {
            if (!date) return <div key={i} />;
            const day = Number(date.slice(-2));
            const available = availableDates.has(date);
            const isToday = date === todayStr;
            const isSelected = date === selected;
            return (
              <button
                key={date}
                disabled={!available}
                onClick={() => available && onSelect(date)}
                style={{
                  background: isSelected ? '#1db954' : available ? '#1a1a1a' : 'transparent',
                  color: isSelected ? '#fff' : available ? '#fff' : '#333',
                  border: isToday && !isSelected ? '1px solid #1db954' : '1px solid transparent',
                  borderRadius: 8, padding: '9px 0', fontSize: 13,
                  fontWeight: isToday || isSelected ? 700 : 500,
                  cursor: available ? 'pointer' : 'default', transition: 'background 0.15s, color 0.15s',
                }}
              >{day}</button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

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

function ScoreRow({ score, rank, admin, onDelete }: { score: Score; rank: number; admin: boolean; onDelete: (s: Score) => void }) {
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
        {admin ? (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(score); }}
            title="Delete score"
            style={{
              background: 'none', border: '1px solid #4a2020', color: '#a04040',
              borderRadius: 6, padding: '2px 8px', fontSize: 12, cursor: 'pointer', marginLeft: 2,
            }}
          >✕</button>
        ) : (
          <span style={{ color: '#444', fontSize: 12, marginLeft: 2 }}>▸</span>
        )}
      </div>
      {open && <ScreenshotModal url={score.screenshotUrl} onClose={() => setOpen(false)} />}
    </>
  );
}

function TodayTab({ scores, leagueId, admin, onDelete }: { scores: Score[]; leagueId: string; admin: boolean; onDelete: (s: Score) => void }) {
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
              {sportScores.map((s, i) => <ScoreRow key={s.id} score={s} rank={i + 1} admin={admin} onDelete={onDelete} />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function monthLabel(ym: string) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

const STAT_TILE: CSSProperties = {
  background: '#141414', border: '1px solid #222', borderRadius: 9,
  padding: '15px 7px 10px', textAlign: 'center', position: 'relative',
};

function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
const RANK_COLORS: Record<number, string> = { 1: '#f5c518', 2: '#b8bdc7', 3: '#cd8032' };

function StatTile({ label, value, color, sub, rank, tooltip }: { label: string; value: string | number; color?: string; sub?: string; rank?: number; tooltip?: ReactNode }) {
  // Hover on desktop, tap-to-toggle on touch (the app is phone-first).
  const [tipOpen, setTipOpen] = useState(false);
  return (
    <div
      style={{ ...STAT_TILE, cursor: tooltip ? 'pointer' : undefined }}
      onMouseEnter={tooltip ? () => setTipOpen(true) : undefined}
      onMouseLeave={tooltip ? () => setTipOpen(false) : undefined}
      onClick={tooltip ? () => setTipOpen((o) => !o) : undefined}
    >
      {tooltip && tipOpen && (
        <div style={{
          position: 'absolute', bottom: 'calc(100% + 6px)', left: '50%', transform: 'translateX(-50%)',
          background: '#1c1c1c', border: '1px solid #333', borderRadius: 8, padding: '8px 11px',
          zIndex: 20, whiteSpace: 'nowrap', textAlign: 'left', boxShadow: '0 6px 20px rgba(0,0,0,0.55)',
        }}>{tooltip}</div>
      )}
      {rank !== undefined && (
        <span style={{
          position: 'absolute', top: 4, right: 6, fontSize: 11, fontWeight: 800,
          color: RANK_COLORS[rank] || '#777', letterSpacing: 0.3,
        }}>{ordinal(rank)}</span>
      )}
      <div style={{ fontWeight: 800, fontSize: 17, color: color || '#fff' }}>
        {value}
        {sub && <span style={{ fontSize: 10, fontWeight: 600, color: '#666', marginLeft: 3 }}>{sub}</span>}
      </div>
      <div style={{ fontSize: 9.5, color: '#555', letterSpacing: 0.5, textTransform: 'uppercase', fontWeight: 700, marginTop: 3 }}>{label}</div>
    </div>
  );
}

function AllStatsView({
  stats, monthlyTitles,
}: {
  stats: ReturnType<typeof computePlayerStats>;
  monthlyTitles: Record<string, { total: number; bySport: Record<string, number> }>;
}) {
  // Full-history stat sheet: everything we track, plus wins + placement.
  // Ranked by wins, then avg placement (lower is better), then avg percentile.
  const ranked = [...stats].sort(
    (a, b) => b.wins - a.wins || a.avgPlacement - b.avgPlacement || b.avgPercentile - a.avgPercentile
  );
  // League rank for one stat: 1 + players strictly better. Ties share a rank.
  type P = (typeof ranked)[number];
  const leagueRank = (p: P, get: (x: P) => number, lowerIsBetter = false) =>
    1 + ranked.filter((q) => (lowerIsBetter ? get(q) < get(p) : get(q) > get(p))).length;
  // Per-sport rank among players who played that sport, for any breakdown stat.
  const sportRank = (p: P, sport: string, get: (sd: P['sportBreakdown'][string]) => number, lowerIsBetter = false) => {
    const field = ranked.filter((q) => q.sportBreakdown[sport]);
    const mine = get(p.sportBreakdown[sport]);
    return {
      rank: 1 + field.filter((q) => (lowerIsBetter ? get(q.sportBreakdown[sport]) < mine : get(q.sportBreakdown[sport]) > mine)).length,
      of: field.length,
    };
  };
  // Shared tooltip body: one row per sport with rank + a trailing detail value.
  const sportRankTooltip = (p: P, title: string, get: (sd: P['sportBreakdown'][string]) => number, detail: (sd: P['sportBreakdown'][string]) => string, lowerIsBetter = false) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <div style={{ fontSize: 9, color: '#666', fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>{title}</div>
      {Object.keys(p.sportBreakdown).sort().map((s) => {
        const r = sportRank(p, s, get, lowerIsBetter);
        return (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5 }}>
            <span style={{ fontWeight: 800, color: sportColor(s), minWidth: 30 }}>{s}</span>
            <span style={{ fontWeight: 800, color: RANK_COLORS[r.rank] || '#ccc' }}>{ordinal(r.rank)}</span>
            <span style={{ color: '#666' }}>of {r.of}</span>
            <span style={{ color: '#555', marginLeft: 'auto', paddingLeft: 10 }}>{detail(p.sportBreakdown[s])}</span>
          </div>
        );
      })}
    </div>
  );
  const SPORT_COLS = '52px repeat(6, 1fr)';
  // Month titles: whoever led a sport's avg percentile for a calendar month.
  const titlesOf = (pl: P) => monthlyTitles[pl.playerName.toLowerCase()]?.total ?? 0;
  const titlesOfSport = (pl: P, sport: string) => monthlyTitles[pl.playerName.toLowerCase()]?.bySport[sport] ?? 0;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {ranked.map((p, i) => {
        const medal = ['🥇', '🥈', '🥉'][i];
        const sports = Object.keys(p.sportBreakdown).sort();
        const titlesTooltip = (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div style={{ fontSize: 9, color: '#666', fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>Titles rank by sport</div>
            {sports.map((s) => {
              const mine = titlesOfSport(p, s);
              const field = ranked.filter((q) => q.sportBreakdown[s]);
              const r = 1 + field.filter((q) => titlesOfSport(q, s) > mine).length;
              return (
                <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5 }}>
                  <span style={{ fontWeight: 800, color: sportColor(s), minWidth: 30 }}>{s}</span>
                  <span style={{ fontWeight: 800, color: RANK_COLORS[r] || '#ccc' }}>{ordinal(r)}</span>
                  <span style={{ color: '#666' }}>of {field.length}</span>
                  <span style={{ color: '#555', marginLeft: 'auto', paddingLeft: 10 }}>{mine} title{mine !== 1 ? 's' : ''}</span>
                </div>
              );
            })}
          </div>
        );
        return (
          <div key={p.playerName} style={{
            background: '#111', border: '1px solid #222', borderRadius: 12, padding: '14px 14px 12px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: 17, minWidth: 22, textAlign: 'center' }}>
                {medal ?? <span style={{ color: '#555', fontSize: 13 }}>{i + 1}</span>}
              </span>
              <span style={{ fontWeight: 800, fontSize: 15, color: '#fff', flex: 1 }}>{p.playerName}</span>
              {p.currentStreak > 1 && <span style={{ color: '#f5a623', fontSize: 12, fontWeight: 700 }}>🔥 {p.currentStreak}d</span>}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 6 }}>
              <StatTile
                label="Wins"
                value={`🏆 ${p.wins}`}
                color="#f5c518"
                rank={leagueRank(p, (x) => x.wins)}
                tooltip={sportRankTooltip(p, 'Wins rank by sport', (sd) => sd.wins, (sd) => `${sd.wins} win${sd.wins !== 1 ? 's' : ''}`)}
              />
              <StatTile
                label="Titles"
                value={`🎖️ ${titlesOf(p)}`}
                color="#e0a72c"
                rank={leagueRank(p, titlesOf)}
                tooltip={titlesTooltip}
              />
              <StatTile
                label="Avg Place"
                value={p.avgPlacement}
                color="#1db954"
                rank={leagueRank(p, (x) => x.avgPlacement, true)}
                tooltip={sportRankTooltip(p, 'Place rank by sport', (sd) => sd.avgPlacement, (sd) => `${sd.avgPlacement} avg`, true)}
              />
              <StatTile label="Avg %ile" value={`${p.avgPercentile}%`} rank={leagueRank(p, (x) => x.avgPercentile)} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 12 }}>
              <StatTile label="Games" value={p.gamesPlayed} rank={leagueRank(p, (x) => x.gamesPlayed)} />
              <StatTile label="Days" value={p.daysPlayed} rank={leagueRank(p, (x) => x.daysPlayed)} />
              <StatTile label="Best %ile" value={`${p.bestPercentile}%`} rank={leagueRank(p, (x) => x.bestPercentile)} />
              <StatTile label="Purples" value={`💜 ${p.purpleHits}`} color="#a855f7" rank={leagueRank(p, (x) => x.purpleHits)} />
            </div>

            {/* Per-sport breakdown: every stat we keep per category */}
            <div style={{ display: 'grid', gridTemplateColumns: SPORT_COLS, gap: 4, padding: '0 2px 4px' }}>
              {['', 'W', '🎖️', 'Plc', 'Avg%', 'Best%', '💜'].map((h, k) => (
                <div key={k} style={{ fontSize: 9, color: '#444', fontWeight: 700, textAlign: k === 0 ? 'left' : 'center', letterSpacing: 0.5 }}>{h}</div>
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {sports.map((s) => {
                const sd = p.sportBreakdown[s];
                return (
                  <div key={s} style={{
                    display: 'grid', gridTemplateColumns: SPORT_COLS, gap: 4, alignItems: 'center',
                    background: sportBg(s), border: `1px solid ${sportColor(s)}25`, borderRadius: 7, padding: '6px 2px 6px 6px',
                  }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color: sportColor(s), letterSpacing: 0.5 }}>
                      {s} <span style={{ color: '#555', fontWeight: 600 }}>×{sd.count}</span>
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: sd.wins > 0 ? '#f5c518' : '#555', textAlign: 'center' }}>{sd.wins}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: titlesOfSport(p, s) > 0 ? '#e0a72c' : '#555', textAlign: 'center' }}>{titlesOfSport(p, s)}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#ccc', textAlign: 'center' }}>{sd.avgPlacement}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#ccc', textAlign: 'center' }}>{sd.avgPercentile}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#ccc', textAlign: 'center' }}>{sd.bestPercentile}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: sd.purpleHits > 0 ? '#a855f7' : '#444', textAlign: 'center' }}>{sd.purpleHits}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StatsTab({ scores, currentMonth }: { scores: Score[]; currentMonth: string }) {
  // Season = a calendar month sliced from the same scores we already have.
  // "This Month" resets the percentile leaderboard each month; "All-Time" is the
  // full history; "All Stats" is the full-history stat sheet (wins, placement,
  // and everything else we track). Nothing is stored server-side — it's all a
  // filter on `scores`.
  const [range, setRange] = useState<'month' | 'alltime' | 'allstats'>('month');
  const [month, setMonth] = useState(currentMonth);
  const [activeSport, setActiveSport] = useState('');

  // Months that actually have scores, ascending. Bounds the month stepper.
  const months = useMemo(() => [...new Set(scores.map((s) => s.date.slice(0, 7)))].sort(), [scores]);
  const earliestMonth = months[0] ?? currentMonth;
  const canPrev = month > earliestMonth;
  const canNext = month < currentMonth;
  function stepMonth(delta: number) {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(Date.UTC(y, m - 1 + delta, 1));
    setMonth(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
  }

  const filtered = useMemo(
    () => (range === 'month' ? scores.filter((s) => s.date.startsWith(month)) : scores),
    [scores, range, month],
  );
  const stats = useMemo(() => computePlayerStats(filtered), [filtered]);
  // Month titles are always all-time — "won March" doesn't depend on the
  // window toggle, so this is computed off the full `scores`, not `filtered`.
  const monthlyTitles = useMemo(() => aggregateMonthlyTitles(computeMonthlyTitles(scores)), [scores]);

  const allSports = [...new Set(stats.flatMap((p) => Object.keys(p.sportBreakdown)))].sort();
  const sport = activeSport && allSports.includes(activeSport) ? activeSport : allSports[0];

  const sportRanking = stats
    .filter((p) => sport && p.sportBreakdown[sport])
    .map((p) => ({ ...p, sd: p.sportBreakdown[sport] }))
    .sort((a, b) => b.sd.avgPercentile - a.sd.avgPercentile);

  return (
    <div>
      {/* Window toggle: This Month vs All-Time vs All Stats */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {(['month', 'alltime', 'allstats'] as const).map((w) => (
          <button key={w} onClick={() => setRange(w)} style={{
            flex: 1, background: range === w ? '#1db954' : '#1a1a1a',
            color: range === w ? '#fff' : '#888',
            border: `1px solid ${range === w ? '#1db954' : '#2a2a2a'}`,
            borderRadius: 20, padding: '8px 0', fontSize: 12, fontWeight: 700,
            cursor: 'pointer', letterSpacing: 0.3, transition: 'all 0.15s',
          }}>{w === 'month' ? 'This Month' : w === 'alltime' ? 'All-Time' : 'All Stats'}</button>
        ))}
      </div>

      {/* Month stepper (only in month view) */}
      {range === 'month' && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <button onClick={() => canPrev && stepMonth(-1)} disabled={!canPrev} style={{
            background: 'none', border: 'none', color: canPrev ? '#666' : '#2a2a2a',
            fontSize: 20, cursor: canPrev ? 'pointer' : 'default', padding: '4px 10px',
          }}>‹</button>
          <span style={{ fontSize: 13, fontWeight: 700, color: month === currentMonth ? '#1db954' : '#ccc' }}>
            {month === currentMonth ? `${monthLabel(month)} · This Month` : monthLabel(month)}
          </span>
          <button onClick={() => canNext && stepMonth(1)} disabled={!canNext} style={{
            background: 'none', border: 'none', color: canNext ? '#666' : '#2a2a2a',
            fontSize: 20, cursor: canNext ? 'pointer' : 'default', padding: '4px 10px',
          }}>›</button>
        </div>
      )}

      {allSports.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#444', padding: '48px 0', fontSize: 14 }}>
          {range === 'month' ? `No games in ${monthLabel(month)}.` : 'No data yet.'}
        </div>
      ) : range === 'allstats' ? (
        <AllStatsView stats={stats} monthlyTitles={monthlyTitles} />
      ) : (
      <>
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
                  {p.currentStreak > 1 && <span style={{ color: '#f5a623', marginLeft: 8 }}>🔥 {p.currentStreak}d</span>}
                  {p.sd.purpleHits > 0 && <span style={{ color: '#a855f7', marginLeft: 8 }}>💜 {p.sd.purpleHits}</span>}
                  <span style={{ marginLeft: 8 }}>best {p.sd.bestPercentile}%</span>
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
      </>
      )}
    </div>
  );
}

function CrownsTab({ crowns, onViewDate }: { crowns: TripleCrown[]; onViewDate: (date: string) => void }) {
  // Per-player leaderboard (counts).
  const counts = new Map<string, { name: string; count: number }>();
  for (const c of crowns) {
    const key = c.playerName.toLowerCase();
    const entry = counts.get(key) || { name: c.playerName, count: 0 };
    entry.count++;
    counts.set(key, entry);
  }
  const ranked = [...counts.values()].sort((a, b) => b.count - a.count);

  // Full history, newest first.
  const history = [...crowns].sort((a, b) => b.date.localeCompare(a.date));

  function fmtDate(d: string) {
    return new Date(d + 'T12:00:00').toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
    });
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: '#f5c518', letterSpacing: 0.5 }}>👑 Triple Crowns</span>
        <span style={{ fontSize: 11, color: '#555' }}>top score in all 3 sports</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 28 }}>
        {ranked.map((p) => (
          <div key={p.name} style={{
            background: 'rgba(245,197,24,0.08)', border: '1px solid rgba(245,197,24,0.25)',
            borderRadius: 10, padding: '11px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: '#fff' }}>{p.name}</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: '#f5c518' }}>
              👑 <span style={{ color: '#888', fontWeight: 600, marginLeft: 2 }}>×{p.count}</span>
            </span>
          </div>
        ))}
      </div>

      <div style={{
        fontSize: 10, color: '#444', letterSpacing: 1, textTransform: 'uppercase',
        fontWeight: 700, marginBottom: 10,
      }}>History</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {history.map((c) => (
          <button
            key={c.date}
            onClick={() => onViewDate(c.date)}
            title="View this day's scores"
            style={{
              background: '#141414', border: '1px solid #222', borderRadius: 10,
              padding: '11px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              cursor: 'pointer', width: '100%', textAlign: 'left', fontFamily: 'inherit',
              transition: 'filter 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.filter = 'brightness(1.4)')}
            onMouseLeave={(e) => (e.currentTarget.style.filter = 'brightness(1)')}
          >
            <span style={{ fontWeight: 700, fontSize: 14, color: '#fff' }}>
              <span style={{ marginRight: 6 }}>👑</span>{c.playerName}
            </span>
            <span style={{ fontSize: 12, color: '#888', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {fmtDate(c.date)}
              <span style={{ color: '#555' }}>›</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function LeaguePage() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const [tab, setTab] = useState<'today' | 'stats' | 'crowns'>('today');
  const [league, setLeague] = useState<League | null>(null);
  const [todayScores, setTodayScores] = useState<Score[]>([]);
  const [allScores, setAllScores] = useState<Score[]>([]);
  const [tripleCrowns, setTripleCrowns] = useState<TripleCrown[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);
  const [navDates, setNavDates] = useState<string[]>([]);
  const [viewDate, setViewDate] = useState<string>('');
  const [admin, setAdmin] = useState(false);
  const [scoreToDelete, setScoreToDelete] = useState<Score | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Check admin status once on mount
  useEffect(() => {
    fetch('/api/admin/check').then((r) => r.json()).then((d) => setAdmin(!!d.admin)).catch(() => {});
  }, []);

  async function handleDeleteScore(score: Score) {
    setDeleting(true);
    try {
      const res = await fetch('/api/admin/score', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leagueId, date: score.date, scoreId: score.id }),
      });
      if (res.ok) {
        setTodayScores((prev) => prev.filter((s) => s.id !== score.id));
        setScoreToDelete(null);
      }
    } finally {
      setDeleting(false);
    }
  }

  // Same 3am PT boundary as the server
  function clientToday(): string {
    const shifted = new Date(Date.now() - 3 * 60 * 60 * 1000);
    return shifted.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
  }

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const todayStr = clientToday();
      const [leagueRes, datesRes, scoresRes, allRes, crownsRes] = await Promise.all([
        fetch(`/api/league?id=${leagueId}`),
        fetch(`/api/scores?leagueId=${leagueId}&mode=dates`),
        fetch(`/api/scores?leagueId=${leagueId}`), // no date = server uses getStatpadDate()
        fetch(`/api/scores?leagueId=${leagueId}&mode=alltime`),
        fetch(`/api/triple-crowns?leagueId=${leagueId}`),
      ]);
      if (leagueRes.status === 404) { setNotFound(true); setLoading(false); return; }
      setLeague(await leagueRes.json());
      const pastDates: string[] = await datesRes.json();
      // Always start at today; prepend it if not already in the list
      const all = pastDates.includes(todayStr) ? pastDates : [todayStr, ...pastDates];
      setNavDates(all);
      setViewDate(todayStr);
      setTodayScores(await scoresRes.json());
      setAllScores(await allRes.json());
      setTripleCrowns(await crownsRes.json());
    } finally {
      setLoading(false);
    }
  }, [leagueId]);

  const loadScoresForDate = useCallback(async (date: string) => {
    const res = await fetch(`/api/scores?leagueId=${leagueId}&date=${date}`);
    setTodayScores(await res.json());
  }, [leagueId]);

  // Jump from the Crowns tab to that day's scoreboard on the Today tab.
  const viewCrownDate = useCallback((date: string) => {
    setViewDate(date);
    loadScoresForDate(date);
    setTab('today');
  }, [loadScoresForDate]);

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
            <div style={{ fontSize: 11, color: '#555', letterSpacing: 0.5 }}>Statpad Score</div>
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
          {(tripleCrowns.length > 0
            ? (['today', 'stats', 'crowns'] as const)
            : (['today', 'stats'] as const)
          ).map((t) => (
            <button key={t} onClick={() => setTab(t)} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: tab === t ? '#fff' : '#444',
              fontWeight: tab === t ? 700 : 400,
              fontSize: 13, padding: '10px 18px',
              borderBottom: tab === t ? '2px solid #fff' : '2px solid transparent',
            }}>
              {t === 'today' ? "Today's Scores" : t === 'stats' ? 'Stats' : '👑 Crowns'}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: '20px 16px 0' }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: '#333', padding: '56px 0', fontSize: 14 }}>Loading...</div>
        ) : tab === 'today' ? (
          <>
            {navDates.length > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <button
                  onClick={() => {
                    const idx = navDates.indexOf(viewDate);
                    if (idx < navDates.length - 1) {
                      const d = navDates[idx + 1];
                      setViewDate(d);
                      loadScoresForDate(d);
                    }
                  }}
                  disabled={navDates.indexOf(viewDate) >= navDates.length - 1}
                  style={{ background: 'none', border: 'none', color: navDates.indexOf(viewDate) >= navDates.length - 1 ? '#2a2a2a' : '#666', fontSize: 20, cursor: navDates.indexOf(viewDate) >= navDates.length - 1 ? 'default' : 'pointer', padding: '4px 8px' }}
                >‹</button>
                <button
                  onClick={() => setPickerOpen(true)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 13, color: viewDate === clientToday() ? '#1db954' : '#888',
                    fontWeight: 600, padding: '4px 10px', borderRadius: 6,
                    display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'inherit',
                  }}
                  title="Pick a date"
                >
                  {viewDate === clientToday()
                    ? 'Today'
                    : new Date(viewDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  <span style={{ fontSize: 9, opacity: 0.6 }}>▾</span>
                </button>
                <button
                  onClick={() => {
                    const idx = navDates.indexOf(viewDate);
                    if (idx > 0) {
                      const d = navDates[idx - 1];
                      setViewDate(d);
                      loadScoresForDate(d);
                    }
                  }}
                  disabled={navDates.indexOf(viewDate) <= 0}
                  style={{ background: 'none', border: 'none', color: navDates.indexOf(viewDate) <= 0 ? '#2a2a2a' : '#666', fontSize: 20, cursor: navDates.indexOf(viewDate) <= 0 ? 'default' : 'pointer', padding: '4px 8px' }}
                >›</button>
              </div>
            )}
            <TodayTab scores={todayScores} leagueId={leagueId} admin={admin} onDelete={(s) => setScoreToDelete(s)} />
          </>
        ) : tab === 'stats' ? (
          <StatsTab scores={allScores} currentMonth={clientToday().slice(0, 7)} />
        ) : (
          <CrownsTab crowns={tripleCrowns} onViewDate={viewCrownDate} />
        )}
      </div>

      {pickerOpen && navDates.length > 0 && (
        <DatePickerPopover
          availableDates={new Set(navDates)}
          selected={viewDate}
          todayStr={clientToday()}
          onClose={() => setPickerOpen(false)}
          onSelect={(d) => {
            setViewDate(d);
            loadScoresForDate(d);
            setPickerOpen(false);
          }}
        />
      )}

      {scoreToDelete && (
        <div onClick={() => !deleting && setScoreToDelete(null)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16,
        }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            background: '#141414', border: '1px solid #2a2a2a', borderRadius: 14,
            padding: 24, maxWidth: 360, width: '100%',
          }}>
            <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 8 }}>Delete this score?</div>
            <div style={{ fontSize: 13, color: '#888', lineHeight: 1.5, marginBottom: 18 }}>
              <strong style={{ color: '#fff' }}>{scoreToDelete.playerName}</strong> &middot; {scoreToDelete.sport} &middot; {scoreToDelete.totalScore.toLocaleString()} ({scoreToDelete.percentile}%)
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setScoreToDelete(null)} disabled={deleting} style={{
                flex: 1, background: '#1a1a1a', color: '#888', border: 'none',
                borderRadius: 10, padding: '11px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>Cancel</button>
              <button onClick={() => handleDeleteScore(scoreToDelete)} disabled={deleting} style={{
                flex: 1, background: '#7a2828', color: '#fff', border: 'none',
                borderRadius: 10, padding: '11px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              }}>{deleting ? 'Deleting…' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
