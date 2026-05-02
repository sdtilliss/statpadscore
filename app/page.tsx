'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    const lastLeague = localStorage.getItem('statpad_last_league');
    if (lastLeague) router.replace(`/${lastLeague}`);
  }, [router]);

  async function createLeague(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    setError('');
    try {
      const res = await fetch('/api/league', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.push(`/${data.id}`);
    } catch {
      setError('Something went wrong. Try again.');
      setCreating(false);
    }
  }

  function joinLeague(e: React.FormEvent) {
    e.preventDefault();
    const id = code.trim().toLowerCase();
    if (id) router.push(`/${id}`);
  }

  return (
    <main style={{
      minHeight: '100vh', background: '#0d0d0d', color: '#fff',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '48px 16px 24px',
    }}>
      <div style={{ width: '100%', maxWidth: 440 }}>
        <h1 style={{ fontSize: 32, fontWeight: 900, margin: '0 0 8px', letterSpacing: -0.8 }}>
          Statpad Score
        </h1>
        <p style={{ fontSize: 15, color: '#888', margin: '0 0 36px', lineHeight: 1.5 }}>
          Daily leaderboards for <a href="https://statpadgame.com" target="_blank" rel="noopener noreferrer" style={{ color: '#1db954', textDecoration: 'none' }}>Statpad</a> — play with your friends, no signup.
        </p>

        {/* Create */}
        <form onSubmit={createLeague} style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: '#555', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>
            Create a new league
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="League name (e.g. The Boys)"
              required
              style={{
                flex: 1, background: '#141414', border: '1px solid #2a2a2a',
                borderRadius: 10, padding: '12px 14px', fontSize: 14,
                color: '#fff', outline: 'none',
              }}
            />
            <button
              type="submit"
              disabled={!name.trim() || creating}
              style={{
                background: name.trim() ? '#1db954' : '#1a1a1a',
                color: name.trim() ? '#fff' : '#444',
                border: 'none', borderRadius: 10, padding: '12px 18px',
                fontWeight: 700, fontSize: 14, cursor: name.trim() ? 'pointer' : 'default',
                whiteSpace: 'nowrap', transition: 'background 0.15s',
              }}
            >
              {creating ? '...' : 'Create'}
            </button>
          </div>
          {error && <div style={{ fontSize: 12, color: '#e07060', marginTop: 8 }}>{error}</div>}
        </form>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{ flex: 1, height: 1, background: '#1e1e1e' }} />
          <span style={{ fontSize: 12, color: '#444' }}>or</span>
          <div style={{ flex: 1, height: 1, background: '#1e1e1e' }} />
        </div>

        {/* Join */}
        <form onSubmit={joinLeague} style={{ marginBottom: 56 }}>
          <div style={{ fontSize: 11, color: '#555', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>
            Join an existing league
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Paste league code"
              style={{
                flex: 1, background: '#141414', border: '1px solid #2a2a2a',
                borderRadius: 10, padding: '12px 14px', fontSize: 14,
                color: '#fff', outline: 'none',
              }}
            />
            <button
              type="submit"
              disabled={!code.trim()}
              style={{
                background: code.trim() ? '#fff' : '#1a1a1a',
                color: code.trim() ? '#000' : '#444',
                border: 'none', borderRadius: 10, padding: '12px 18px',
                fontWeight: 700, fontSize: 14, cursor: code.trim() ? 'pointer' : 'default',
                transition: 'background 0.15s',
              }}
            >
              Join
            </button>
          </div>
        </form>

        {/* How it works */}
        <section style={{ marginBottom: 56 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 18px', letterSpacing: -0.2 }}>How it works</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              { n: '1', t: 'Create a league', d: 'Name it, share the link with your friends.' },
              { n: '2', t: 'Play Statpad and screenshot your result', d: 'Any sport, any day. Just keep the screenshot.' },
              { n: '3', t: 'Upload to your league', d: "Claude reads your score automatically. Leaderboard updates in seconds." },
              { n: '4', t: 'Compete daily', d: 'Resets at 4am PST. Streaks, all-time stats, purple hits, and chat for trash talk.' },
            ].map((s) => (
              <div key={s.n} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <div style={{
                  flexShrink: 0, width: 26, height: 26, borderRadius: '50%',
                  background: '#1a1a1a', border: '1px solid #2a2a2a',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 800, color: '#1db954',
                }}>{s.n}</div>
                <div style={{ flex: 1, paddingTop: 2 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 2 }}>{s.t}</div>
                  <div style={{ fontSize: 13, color: '#777', lineHeight: 1.45 }}>{s.d}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Footer */}
        <footer style={{
          borderTop: '1px solid #1a1a1a', paddingTop: 20,
          fontSize: 11, color: '#444', lineHeight: 1.6, textAlign: 'center',
        }}>
          Not affiliated with Statpad. Just a fan project for friends to play together.
          <br />
          Follow <a href="https://x.com/StatpadScore" target="_blank" rel="noopener noreferrer" style={{ color: '#666', textDecoration: 'none' }}>@StatpadScore</a> for updates.
        </footer>
      </div>
    </main>
  );
}
