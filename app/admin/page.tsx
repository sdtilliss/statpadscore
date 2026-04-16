'use client';

import { useState, useEffect } from 'react';
import type { League } from '@/lib/types';

export default function AdminPage() {
  const [password, setPassword] = useState('');
  const [authed, setAuthed] = useState(false);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (password === 'seth') {
      setAuthed(true);
    } else {
      setError('Wrong password.');
    }
  }

  useEffect(() => {
    if (!authed) return;
    setLoading(true);
    fetch('/api/league?all=1')
      .then((r) => r.json())
      .then((data) => setLeagues(data))
      .finally(() => setLoading(false));
  }, [authed]);

  function copyLink(id: string) {
    navigator.clipboard.writeText(`${window.location.origin}/${id}`);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }

  const base: React.CSSProperties = {
    minHeight: '100vh', background: '#0d0d0d', color: '#fff',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', padding: '24px 16px',
  };

  if (!authed) {
    return (
      <main style={base}>
        <div style={{ width: '100%', maxWidth: 360 }}>
          <h1 style={{ fontSize: 20, fontWeight: 900, margin: '0 0 24px' }}>Admin</h1>
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              autoFocus
              style={{
                background: '#141414', border: '1px solid #2a2a2a',
                borderRadius: 10, padding: '13px 14px', fontSize: 15,
                color: '#fff', outline: 'none',
              }}
            />
            {error && <div style={{ fontSize: 13, color: '#e07060' }}>{error}</div>}
            <button type="submit" style={{
              background: '#fff', color: '#000', border: 'none',
              borderRadius: 10, padding: '13px', fontWeight: 700,
              fontSize: 14, cursor: 'pointer',
            }}>Enter</button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main style={{ ...base, justifyContent: 'flex-start', paddingTop: 40 }}>
      <div style={{ width: '100%', maxWidth: 480 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <h1 style={{ fontSize: 20, fontWeight: 900, margin: 0 }}>All Leagues</h1>
          <a href="/" style={{ fontSize: 13, color: '#555', textDecoration: 'none' }}>← Home</a>
        </div>

        {loading ? (
          <div style={{ color: '#444', fontSize: 14 }}>Loading...</div>
        ) : leagues.length === 0 ? (
          <div style={{ color: '#444', fontSize: 14 }}>No leagues yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {leagues.map((league) => (
              <div key={league.id} style={{
                background: '#141414', border: '1px solid #222',
                borderRadius: 10, padding: '14px 16px',
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: '#fff' }}>{league.name}</div>
                  <div style={{ fontSize: 11, color: '#555', marginTop: 3, fontFamily: 'monospace' }}>
                    {league.id} &middot; {new Date(league.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <a href={`/${league.id}`} style={{
                  color: '#555', fontSize: 12, textDecoration: 'none',
                  padding: '6px 10px', border: '1px solid #2a2a2a', borderRadius: 8,
                }}>View</a>
                <button onClick={() => copyLink(league.id)} style={{
                  background: copied === league.id ? '#1db954' : 'none',
                  color: copied === league.id ? '#fff' : '#555',
                  border: '1px solid #2a2a2a', borderRadius: 8,
                  padding: '6px 10px', fontSize: 12, cursor: 'pointer',
                  transition: 'all 0.15s',
                }}>
                  {copied === league.id ? '✓' : '⎘'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
