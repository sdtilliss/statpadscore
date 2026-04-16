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
      justifyContent: 'center', padding: '24px 16px',
    }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <h1 style={{ fontSize: 28, fontWeight: 900, margin: '0 0 4px', letterSpacing: -0.5 }}>
          statpadscore
        </h1>
        <p style={{ fontSize: 14, color: '#555', margin: '0 0 40px' }}>
          Daily Statpad leaderboard for you and your friends
        </p>

        {/* Create */}
        <form onSubmit={createLeague} style={{ marginBottom: 32 }}>
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

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
          <div style={{ flex: 1, height: 1, background: '#1e1e1e' }} />
          <span style={{ fontSize: 12, color: '#444' }}>or</span>
          <div style={{ flex: 1, height: 1, background: '#1e1e1e' }} />
        </div>

        {/* Join */}
        <form onSubmit={joinLeague}>
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
      </div>
    </main>
  );
}
