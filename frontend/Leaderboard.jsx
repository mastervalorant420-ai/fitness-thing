// src/pages/Leaderboard.jsx
import React, { useEffect, useState, useCallback } from 'react';
import { api } from './client.js';

function SkeletonRow() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '48px 1fr 100px 100px 80px', gap: '16px',
      padding: '18px 24px', background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)' }}>
      {[48, 180, 80, 80, 60].map((w, i) => (
        <div key={i} className="skeleton" style={{ height: 20, width: w, borderRadius: 4 }} />
      ))}
    </div>
  );
}

function rankStyle(rank) {
  if (rank === 1) return 'top-1';
  if (rank === 2) return 'top-2';
  if (rank === 3) return 'top-3';
  return '';
}

function rankClass(rank) {
  if (rank === 1) return 'gold';
  if (rank === 2) return 'silver';
  if (rank === 3) return 'bronze';
  return '';
}

function rankIcon(rank) {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return rank;
}

function streakLabel(streak) {
  if (streak === 0) return '—';
  return `${streak}d 🔥`;
}

export default function Leaderboard() {
  const [board, setBoard]         = useState([]);
  const [generatedAt, setGeneratedAt] = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const { leaderboard, generated_at } = await api.get('/leaderboard');
      setBoard(leaderboard);
      setGeneratedAt(generated_at);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const formatTime = (iso) => {
    try {
      return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
  };

  return (
    <div>
      <div className="page-header">
        <p className="eyebrow">Rankings</p>
        <h2>Leaderboard</h2>
        <p>
          Ranked by competition score — approved hours × streak multiplier (up to 2×).
          {generatedAt && (
            <span style={{ marginLeft: 8, fontSize: '0.78rem', color: 'var(--text-3)' }}>
              Updated at {formatTime(generatedAt)}
            </span>
          )}
        </p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
        <button className="btn btn-outline btn-sm" onClick={load} disabled={loading}>
          {loading ? <><span className="spinner spinner-dark" /> Refreshing…</> : '↻ Refresh'}
        </button>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: 20 }}>
          <span>⚠</span> {error}
        </div>
      )}

      {loading ? (
        <div className="lb-grid">
          {[...Array(6)].map((_, i) => <SkeletonRow key={i} />)}
        </div>
      ) : board.length === 0 ? (
        <div className="empty-state">
          <div className="icon">🏆</div>
          <p>No athletes on the board yet. Be the first!</p>
        </div>
      ) : (
        <div className="lb-grid">
          {board.map((entry, i) => {
            const rank = i + 1;
            return (
              <div key={entry.user_id} className={`lb-row ${rankStyle(rank)}`}>
                <div className={`lb-rank display ${rankClass(rank)}`}>
                  {rankIcon(rank)}
                </div>

                <div className="lb-user">
                  <div className="lb-avatar">
                    {entry.username.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="lb-username">{entry.username}</div>
                    {entry.streak > 0 && (
                      <div style={{ fontSize: '0.72rem', color: 'var(--accent)', fontWeight: 600 }}>
                        {entry.streak}-day streak 🔥
                      </div>
                    )}
                  </div>
                </div>

                <div className="lb-stat">
                  <div className="lb-stat-val">{Number(entry.total_approved_hrs).toFixed(1)}h</div>
                  <div className="lb-stat-label">Approved hrs</div>
                </div>

                <div className="lb-stat">
                  <div className="lb-stat-val">{streakLabel(entry.streak)}</div>
                  <div className="lb-stat-label">Streak</div>
                </div>

                <div className="lb-stat">
                  <div className="lb-score">{Math.round(entry.score)}</div>
                  <div className="lb-stat-label">Score</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ marginTop: 32, padding: '20px 24px', background: 'var(--surface)',
        border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '0.82rem',
        color: 'var(--text-2)', display: 'flex', gap: 32 }}>
        <div>
          <strong style={{ color: 'var(--text-1)' }}>Score formula</strong><br />
          (Σ approved hours × 100) × (1 + min(streak, 10) × 0.1)
        </div>
        <div>
          <strong style={{ color: 'var(--text-1)' }}>Multiplier cap</strong><br />
          10-day streak = 2.0× (max)
        </div>
      </div>
    </div>
  );
}
