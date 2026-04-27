'use client';

import { useState, useEffect, useCallback } from 'react';
import type { League } from '@/lib/types';

export default function AdminPage() {
  const [password, setPassword] = useState('');
  const [authed, setAuthed] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<League | null>(null);

  // On mount, check if we already have a valid admin cookie
  useEffect(() => {
    fetch('/api/admin/check')
      .then((r) => r.json())
      .then((data) => setAuthed(!!data.admin))
      .finally(() => setCheckingAuth(false));
  }, []);

  const loadLeagues = useCallback(() => {
    setLoading(true);
    fetch('/api/league?all=1')
      .then((r) => r.json())
      .then((data) => setLeagues(data))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (authed) loadLeagues();
  }, [authed, loadLeagues]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      setAuthed(true);
      setPassword('');
    } else {
      setError('Wrong password.');
    }
  }

  async function handleLogout() {
    await fetch('/api/admin/logout', { method: 'POST' });
    setAuthed(false);
    setLeagues([]);
  }

  async function handleDeleteLeague(league: League) {
    setDeletingId(league.id);
    try {
      const res = await fetch('/api/admin/league', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leagueId: league.id }),
      });
      if (res.ok) {
        setLeagues((prev) => prev.filter((l) => l.id !== league.id));
        setConfirmDelete(null);
      }
    } finally {
      setDeletingId(null);
    }
  }

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

  if (checkingAuth) {
    return <main style={base}><div style={{ color: '#444', fontSize: 14 }}>Loading...</div></main>;
  }

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
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: '#555', fontSize: 13, cursor: 'pointer', padding: 0 }}>Log out</button>
            <a href="/" style={{ fontSize: 13, color: '#555', textDecoration: 'none' }}>← Home</a>
          </div>
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
                display: 'flex', alignItems: 'center', gap: 8,
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
                <button onClick={() => setConfirmDelete(league)} style={{
                  background: 'none', color: '#a04040',
                  border: '1px solid #4a2020', borderRadius: 8,
                  padding: '6px 10px', fontSize: 12, cursor: 'pointer',
                }}>✕</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {confirmDelete && (
        <div onClick={() => setConfirmDelete(null)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: 16,
        }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            background: '#141414', border: '1px solid #2a2a2a', borderRadius: 14,
            padding: 24, maxWidth: 360, width: '100%',
          }}>
            <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 8 }}>Delete league?</div>
            <div style={{ fontSize: 13, color: '#888', lineHeight: 1.5, marginBottom: 18 }}>
              This will permanently delete <strong style={{ color: '#fff' }}>{confirmDelete.name}</strong>, all of its scores, and all of its messages. This can't be undone.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setConfirmDelete(null)} style={{
                flex: 1, background: '#1a1a1a', color: '#888', border: 'none',
                borderRadius: 10, padding: '11px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>Cancel</button>
              <button onClick={() => handleDeleteLeague(confirmDelete)} disabled={deletingId === confirmDelete.id} style={{
                flex: 1, background: '#7a2828', color: '#fff', border: 'none',
                borderRadius: 10, padding: '11px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              }}>{deletingId === confirmDelete.id ? 'Deleting…' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
