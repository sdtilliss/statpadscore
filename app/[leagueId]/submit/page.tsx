'use client';

import { useState, useRef, useEffect } from 'react';
import { useParams } from 'next/navigation';
import type { Score } from '@/lib/types';

export default function LeagueSubmitPage() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const [playerName, setPlayerName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [result, setResult] = useState<Score | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('statpad_name');
    if (saved) setPlayerName(saved);
  }, []);

  async function compressImage(f: File): Promise<File> {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(f);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const MAX = 1200;
        const scale = Math.min(1, MAX / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          resolve(blob ? new File([blob], f.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' }) : f);
        }, 'image/jpeg', 0.88);
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(f); };
      img.src = url;
    });
  }

  function handleFile(f: File) {
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setStatus('idle');
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f && f.type.startsWith('image/')) handleFile(f);
  }

  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const item = Array.from(e.clipboardData?.items || []).find((i) => i.type.startsWith('image/'));
      if (item) { const f = item.getAsFile(); if (f) handleFile(f); }
    }
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !playerName.trim()) return;
    localStorage.setItem('statpad_name', playerName.trim());
    setStatus('loading');
    setErrorMsg('');
    const compressed = await compressImage(file);
    const formData = new FormData();
    formData.append('screenshot', compressed);
    formData.append('playerName', playerName.trim());
    formData.append('leagueId', leagueId);
    try {
      const res = await fetch('/api/submit', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong');
      setResult(data.score);
      setStatus('success');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong');
      setStatus('error');
    }
  }

  const SPORT_COLORS: Record<string, string> = {
    MLB: '#C4952A', NFL: '#3B6BB5', NBA: '#C84B31', NHL: '#4A90D9',
  };

  if (status === 'success' && result) {
    const color = SPORT_COLORS[result.sport] || '#1db954';
    return (
      <main style={{
        minHeight: '100vh', background: '#0d0d0d', color: '#fff',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        maxWidth: 480, margin: '0 auto', padding: '40px 16px',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
      }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
        <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 4px' }}>Score saved!</h2>
        <div style={{ fontSize: 13, color: '#555', marginBottom: 28 }}>
          {result.playerName} &middot; {result.sport} &middot; {new Date().toLocaleDateString()}
        </div>
        <div style={{
          background: '#141414', border: `1px solid ${color}40`,
          borderRadius: 14, padding: '20px 24px', width: '100%', textAlign: 'center', marginBottom: 24,
        }}>
          <span style={{ background: color, color: '#fff', fontSize: 10, fontWeight: 800, padding: '3px 10px', borderRadius: 20, letterSpacing: 1 }}>
            {result.sport}
          </span>
          <div style={{ fontSize: 48, fontWeight: 900, color, marginTop: 12, lineHeight: 1 }}>
            {result.totalScore.toLocaleString()}
          </div>
          <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>
            {result.category} &middot; {result.totalGuesses} guesses
          </div>
          <div style={{ fontSize: 13, color: '#888', marginTop: 8 }}>
            Beat <strong style={{ color: '#fff' }}>{result.percentile}%</strong> of scores
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, width: '100%' }}>
          <a href={`/${leagueId}`} style={{
            flex: 1, background: '#1a1a1a', color: '#fff', padding: '13px',
            borderRadius: 12, textDecoration: 'none', fontWeight: 600, fontSize: 14, textAlign: 'center',
          }}>View Leaderboard</a>
          <button onClick={() => { setStatus('idle'); setFile(null); setPreview(null); setResult(null); }} style={{
            flex: 1, background: '#1db954', color: '#fff', padding: '13px',
            borderRadius: 12, border: 'none', fontWeight: 600, fontSize: 14, cursor: 'pointer',
          }}>Submit Another</button>
        </div>
      </main>
    );
  }

  return (
    <main style={{
      minHeight: '100vh', background: '#0d0d0d', color: '#fff',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      maxWidth: 480, margin: '0 auto', padding: '24px 16px 80px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <a href={`/${leagueId}`} style={{ color: '#555', textDecoration: 'none', fontSize: 22, lineHeight: 1 }}>←</a>
        <h1 style={{ fontSize: 20, fontWeight: 900, margin: 0 }}>Submit Score</h1>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={{ fontSize: 12, color: '#666', letterSpacing: 0.5, textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
            Your Name
          </label>
          <input
            type="text" value={playerName} onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Enter your name" required
            style={{
              width: '100%', background: '#141414', border: '1px solid #2a2a2a',
              borderRadius: 10, padding: '13px 14px', fontSize: 15, color: '#fff',
              outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>

        <div>
          <label style={{ fontSize: 12, color: '#666', letterSpacing: 0.5, textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
            Screenshot
          </label>
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            style={{
              border: `2px dashed ${dragging ? '#1db954' : preview ? '#2a2a2a' : '#222'}`,
              borderRadius: 12, cursor: 'pointer', overflow: 'hidden',
              transition: 'border-color 0.15s',
              background: dragging ? 'rgba(29,185,84,0.05)' : '#111',
            }}
          >
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Preview" style={{ width: '100%', display: 'block', maxHeight: 360, objectFit: 'cover' }} />
            ) : (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: '#444' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📸</div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>Tap to upload screenshot</div>
                <div style={{ fontSize: 12, color: '#333', marginTop: 4 }}>
                  or drag & drop{typeof window !== 'undefined' && !('ontouchstart' in window) ? ' · Cmd+V to paste' : ''}
                </div>
              </div>
            )}
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={onFileChange} style={{ display: 'none' }} />
          {preview && (
            <button type="button" onClick={() => { setFile(null); setPreview(null); }} style={{
              marginTop: 8, background: 'none', border: 'none', color: '#555', fontSize: 12, cursor: 'pointer', padding: 0,
            }}>✕ Remove photo</button>
          )}
        </div>

        {status === 'error' && (
          <div style={{ background: 'rgba(200,75,49,0.12)', border: '1px solid rgba(200,75,49,0.3)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#e07060' }}>
            {errorMsg}
          </div>
        )}

        <button type="submit" disabled={!file || !playerName.trim() || status === 'loading'} style={{
          background: file && playerName.trim() ? '#1db954' : '#1a1a1a',
          color: file && playerName.trim() ? '#fff' : '#444',
          border: 'none', borderRadius: 12, padding: '15px',
          fontSize: 15, fontWeight: 700, cursor: file && playerName.trim() ? 'pointer' : 'default',
          transition: 'background 0.15s, color 0.15s', marginTop: 4,
        }}>
          {status === 'loading' ? 'Reading screenshot...' : 'Submit Score'}
        </button>
      </form>
    </main>
  );
}
