// src/pages/Admin.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { api } from './client.js';
import { useAuth } from './AuthContext.jsx';

// ── Tab: Pending Logs ─────────────────────────────────────────────────────────
function PendingLogs() {
  const [logs, setLogs]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [verifying, setVerifying] = useState({});
  const [toast, setToast]     = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const { pending_logs } = await api.get('/admin/pending-logs');
      setLogs(pending_logs);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function verifyLog(log_id) {
    setVerifying((v) => ({ ...v, [log_id]: true }));
    setToast(null);
    try {
      await api.patch('/admin/verify-log', { log_id });
      setToast({ type: 'success', msg: `Log ${log_id.slice(0,8)}… verified successfully.` });
      setLogs((prev) => prev.filter((l) => l.id !== log_id));
    } catch (e) {
      setToast({ type: 'error', msg: e.message });
    } finally {
      setVerifying((v) => ({ ...v, [log_id]: false }));
    }
  }

  function formatTs(ts) {
    try { return new Date(ts).toLocaleString(); }
    catch { return ts; }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Pending Verification</h3>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-2)', marginTop: 2 }}>
            Logs over 1 hour require manual approval before counting toward scores.
          </p>
        </div>
        <button className="btn btn-outline btn-sm" onClick={load} disabled={loading}>
          {loading ? <><span className="spinner spinner-dark" /> Loading…</> : '↻ Refresh'}
        </button>
      </div>

      {toast && (
        <div className={`alert alert-${toast.type === 'success' ? 'success' : 'error'}`} style={{ marginBottom: 16 }}>
          <span>{toast.type === 'success' ? '✓' : '⚠'}</span> {toast.msg}
        </div>
      )}

      {error && (
        <div className="alert alert-error" style={{ marginBottom: 16 }}>
          <span>⚠</span> {error}
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[...Array(3)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 56, borderRadius: 'var(--radius-sm)' }} />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <div className="empty-state">
          <div className="icon">✅</div>
          <p>No logs pending verification. All clear!</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Exercise</th>
                  <th>Duration</th>
                  <th>Timestamp</th>
                  <th>Log ID</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent-2)',
                          color: 'var(--accent)', fontSize: '0.7rem', fontWeight: 700,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {log.username?.slice(0,2).toUpperCase()}
                        </div>
                        <span style={{ fontWeight: 600 }}>{log.username}</span>
                      </div>
                    </td>
                    <td>{log.exercise_name}</td>
                    <td>
                      <span className="badge badge-amber">{log.duration_hrs}h</span>
                    </td>
                    <td style={{ color: 'var(--text-2)', fontSize: '0.8rem' }}>{formatTs(log.timestamp)}</td>
                    <td style={{ color: 'var(--text-3)', fontSize: '0.75rem', fontFamily: 'monospace' }}>
                      {log.id.slice(0,8)}…
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn btn-success btn-sm"
                        onClick={() => verifyLog(log.id)}
                        disabled={verifying[log.id]}
                      >
                        {verifying[log.id]
                          ? <><span className="spinner" style={{ borderTopColor: 'var(--green)' }} /> Verifying…</>
                          : '✓ Verify'
                        }
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tab: Approve Exercise ─────────────────────────────────────────────────────
function ApproveExercise() {
  const [exerciseId, setExerciseId] = useState('');
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState(null);
  const [success, setSuccess]       = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!exerciseId.trim()) return;
    setLoading(true); setError(null); setSuccess(null);
    try {
      const { exercise } = await api.patch('/admin/approve-exercise', { exercise_id: exerciseId.trim() });
      setSuccess(exercise);
      setExerciseId('');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 520 }}>
      <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 6 }}>Approve Exercise</h3>
      <p style={{ fontSize: '0.82rem', color: 'var(--text-2)', marginBottom: 24 }}>
        Only logs tied to an approved exercise count toward the leaderboard score.
        Approving an exercise retroactively counts all its existing logs.
      </p>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: 16 }}>
          <span>⚠</span> {error}
        </div>
      )}

      {success && (
        <div className="alert alert-success" style={{ marginBottom: 16 }}>
          <span>✓</span>
          <div>
            <strong>{success.name}</strong> is now approved.
            All associated logs will count toward scores.
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="field">
          <label htmlFor="ex_id">Exercise ID (UUID)</label>
          <input
            id="ex_id"
            type="text"
            placeholder="e.g. 3f6a1c2d-4e5f-…"
            value={exerciseId}
            onChange={(e) => { setExerciseId(e.target.value); setError(null); setSuccess(null); }}
            required
          />
          <span className="field-hint">The UUID of the exercise to approve.</span>
        </div>

        <div>
          <button type="submit" className="btn btn-primary" disabled={loading || !exerciseId.trim()}>
            {loading
              ? <><span className="spinner" /> Approving…</>
              : '✓ Approve Exercise'
            }
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Admin shell ───────────────────────────────────────────────────────────────
export default function Admin() {
  const { user }     = useAuth();
  const [tab, setTab] = useState('pending');

  return (
    <div>
      <div className="page-header">
        <p className="eyebrow">Admin</p>
        <h2>Admin Panel</h2>
        <p>
          Signed in as <strong>{user?.username}</strong> · Admin access
        </p>
      </div>

      <div className="admin-tabs">
        <button
          className={`admin-tab ${tab === 'pending' ? 'active' : ''}`}
          onClick={() => setTab('pending')}
        >
          🔍 Pending Logs
        </button>
        <button
          className={`admin-tab ${tab === 'approve' ? 'active' : ''}`}
          onClick={() => setTab('approve')}
        >
          ✅ Approve Exercise
        </button>
      </div>

      <div className="card">
        {tab === 'pending' && <PendingLogs />}
        {tab === 'approve' && <ApproveExercise />}
      </div>
    </div>
  );
}
