// src/pages/Feed.jsx
import React, { useMemo } from 'react';
import { useAuth } from './AuthContext.jsx';
import { useSocket } from './useSocket.js';

function timeAgo(ts) {
  if (!ts) return '';
  const diff = Date.now() - new Date(ts).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60)  return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function ActivityItem({ item }) {
  const isVerified = item._verified;
  const isFlagged  = item.flagged && !isVerified;

  return (
    <div className={`feed-item ${isFlagged ? 'flagged' : ''} ${isVerified ? 'verified' : ''}`}>
      <div className={`feed-dot ${isFlagged ? 'flagged' : ''} ${isVerified ? 'verified' : ''}`}>
        {isVerified ? '✓' : isFlagged ? '⚠' : '💪'}
      </div>
      <div className="feed-body">
        <div className="feed-title">
          <strong>{item.username}</strong> logged <strong>{item.duration_hrs}h</strong> of {item.exercise_name}
        </div>
        <div className="feed-meta">
          {isFlagged && <span className="badge badge-amber" style={{ marginRight: 6 }}>⏳ Pending verification</span>}
          {isVerified && <span className="badge badge-green" style={{ marginRight: 6 }}>✓ Verified</span>}
        </div>
      </div>
      <div className="feed-time">{timeAgo(item.timestamp)}</div>
    </div>
  );
}

function VerifiedItem({ item }) {
  return (
    <div className="feed-item verified">
      <div className="feed-dot verified">✓</div>
      <div className="feed-body">
        <div className="feed-title">
          Log <strong>#{item.log_id?.slice(0, 8)}…</strong> verified by <strong>{item.verified_by}</strong>
        </div>
        <div className="feed-meta">
          <span className="badge badge-green">Admin verified</span>
        </div>
      </div>
      <div className="feed-time">just now</div>
    </div>
  );
}

export default function Feed() {
  const { user }                       = useAuth();
  const { connected, activities, verifiedLogs } = useSocket(user?.id);

  const stats = useMemo(() => {
    const total    = activities.length;
    const flagged  = activities.filter((a) => a.flagged).length;
    const verified = activities.filter((a) => a._verified).length;
    const uniqueUsers = new Set(activities.map((a) => a.username)).size;
    return { total, flagged, verified, uniqueUsers };
  }, [activities]);

  // Merge activity + verification events into a single chronological list
  const merged = useMemo(() => {
    const items = [
      ...activities.map((a) => ({ type: 'activity', data: a, _id: a._id })),
      ...verifiedLogs.map((v) => ({ type: 'verified', data: v, _id: v._id })),
    ];
    return items.sort((a, b) => b._id - a._id).slice(0, 60);
  }, [activities, verifiedLogs]);

  return (
    <div>
      <div className="page-header">
        <p className="eyebrow">Real-time</p>
        <h2>Live Activity Feed</h2>
        <p>Watch your fellow competitors log sessions in real time.</p>
      </div>

      <div className="feed-layout">
        {/* Main feed */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <div
              className={`connection-dot ${connected ? 'connected' : 'disconnected'} ${connected ? 'pulse' : ''}`}
            />
            <span style={{ fontSize: '0.82rem', color: connected ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
              {connected ? 'Live' : 'Disconnected — reconnecting…'}
            </span>
            {activities.length > 0 && (
              <span style={{ marginLeft: 'auto', fontSize: '0.78rem', color: 'var(--text-3)' }}>
                {activities.length} event{activities.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {merged.length === 0 ? (
            <div className="empty-state">
              <div className="icon">⚡</div>
              <p>Waiting for activity… be the first to log a workout!</p>
            </div>
          ) : (
            <div className="feed-list">
              {merged.map((item) =>
                item.type === 'activity'
                  ? <ActivityItem key={item._id} item={item.data} />
                  : <VerifiedItem key={item._id} item={item.data} />
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="feed-sidebar">
          <div className="card card-sm">
            <h4>Session Stats</h4>
            <div className="stat-row">
              <span className="stat-label">Events received</span>
              <span className="stat-value">{stats.total}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Active athletes</span>
              <span className="stat-value">{stats.uniqueUsers}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Flagged logs</span>
              <span className="stat-value" style={{ color: stats.flagged > 0 ? 'var(--amber)' : undefined }}>
                {stats.flagged}
              </span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Verified</span>
              <span className="stat-value" style={{ color: 'var(--green)' }}>{stats.verified}</span>
            </div>
          </div>

          <div className="card card-sm" style={{ marginTop: 16 }}>
            <h4>Connection</h4>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' }}>
              <div className={`connection-dot ${connected ? 'connected' : 'disconnected'}`} />
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: connected ? 'var(--green)' : 'var(--red)' }}>
                {connected ? 'Socket connected' : 'Not connected'}
              </span>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-3)', marginTop: 6, lineHeight: 1.5 }}>
              Events stream via Socket.io WebSocket.
              Your personal room is <code style={{ fontSize: '0.75rem', background: 'var(--surface-2)', padding: '1px 4px', borderRadius: 3 }}>
                user:{user?.id?.slice(0,8)}…
              </code>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
