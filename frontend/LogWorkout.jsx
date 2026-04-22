// src/pages/LogWorkout.jsx
import React, { useState } from 'react';
import { api } from './client.js';

const DURATION_PRESETS = [0.25, 0.5, 0.75, 1.0, 1.5, 2.0, 3.0, 4.0];

const ERROR_MESSAGES = {
  INVALID_DURATION:      'Duration must be between 0 and 4 hours.',
  MISSING_EXERCISE:      'Please provide a valid exercise ID.',
  HARD_CAP_EXCEEDED:     'Single session cap is 4 hours — log a shorter session.',
  PHYSICAL_LIMIT_REACHED:'You\'ve already logged 8 hours in the past 24 hours. Rest is training too.',
  EXERCISE_NOT_FOUND:    'That exercise ID wasn\'t found. Ask your admin to add it.',
};

export default function LogWorkout() {
  const [exerciseId, setExerciseId] = useState('');
  const [duration, setDuration]     = useState('');
  const [customDur, setCustomDur]   = useState('');
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState(null);
  const [success, setSuccess]       = useState(null);

  const effectiveDuration = duration !== '__custom__' ? duration : customDur;

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null); setSuccess(null);

    const dur = parseFloat(effectiveDuration);
    if (!exerciseId.trim()) { setError('Exercise ID is required.'); return; }
    if (!dur || dur <= 0)   { setError('Please select or enter a valid duration.'); return; }

    setLoading(true);
    try {
      const { log } = await api.post('/logs', {
        exercise_id:  exerciseId.trim(),
        duration_hrs: dur,
      });

      setSuccess(log);
      setExerciseId('');
      setDuration('');
      setCustomDur('');
    } catch (e) {
      setError(ERROR_MESSAGES[e.code] || e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <p className="eyebrow">Training</p>
        <h2>Log a Workout</h2>
        <p>Record your session. Sessions over 1 hour are flagged for admin verification.</p>
      </div>

      <div className="log-layout">
        {/* Form */}
        <div className="card">
          <form className="log-form" onSubmit={handleSubmit}>

            {error && (
              <div className="alert alert-error">
                <span>⚠</span> {error}
              </div>
            )}

            {success && (
              <div className="alert alert-success">
                <span>✓</span>
                <div>
                  <strong>{success.exercise_name}</strong> — {success.duration_hrs}h logged!
                  {success.needs_verification && (
                    <div style={{ marginTop: 4, fontSize: '0.8rem', color: 'var(--amber)' }}>
                      ⏳ Flagged for admin verification (sessions &gt; 1h)
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="field">
              <label htmlFor="exercise_id">Exercise ID</label>
              <input
                id="exercise_id"
                type="text"
                placeholder="e.g. 3f6a1c2d-…"
                value={exerciseId}
                onChange={(e) => { setExerciseId(e.target.value); setError(null); setSuccess(null); }}
                required
              />
              <span className="field-hint">
                UUID of an approved exercise — ask your admin if you don't have one.
              </span>
            </div>

            <div className="field">
              <label>Duration</label>
              <div className="duration-grid">
                {DURATION_PRESETS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    className={`duration-chip ${duration === String(d) ? 'selected' : ''}`}
                    onClick={() => { setDuration(String(d)); setCustomDur(''); setError(null); setSuccess(null); }}
                  >
                    {d}h
                  </button>
                ))}
                <button
                  type="button"
                  className={`duration-chip ${duration === '__custom__' ? 'selected' : ''}`}
                  style={{ gridColumn: 'span 2' }}
                  onClick={() => { setDuration('__custom__'); setError(null); setSuccess(null); }}
                >
                  Custom
                </button>
              </div>
            </div>

            {duration === '__custom__' && (
              <div className="field">
                <label htmlFor="custom_dur">Custom duration (hours)</label>
                <input
                  id="custom_dur"
                  type="number"
                  step="0.25"
                  min="0.25"
                  max="4"
                  placeholder="e.g. 1.75"
                  value={customDur}
                  onChange={(e) => setCustomDur(e.target.value)}
                  autoFocus
                />
                <span className="field-hint">Will be snapped to nearest 0.25 by the server.</span>
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || !effectiveDuration || !exerciseId}
              style={{ marginTop: 8 }}
            >
              {loading
                ? <><span className="spinner" /> Logging…</>
                : <>✚ Log {effectiveDuration ? `${effectiveDuration}h` : 'Workout'}</>
              }
            </button>
          </form>
        </div>

        {/* Info sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="info-box">
            <h4>Guard Layer Rules</h4>
            <div className="rule-list">
              <div className="rule-item">
                <span className="rule-icon">🔒</span>
                <span><strong>Single session cap:</strong> Max 4 hours per log entry.</span>
              </div>
              <div className="rule-item">
                <span className="rule-icon">📐</span>
                <span><strong>Precision rounding:</strong> Snapped to nearest 0.25h automatically.</span>
              </div>
              <div className="rule-item">
                <span className="rule-icon">⏱</span>
                <span><strong>Daily limit:</strong> Max 8 hours within any 24-hour window.</span>
              </div>
              <div className="rule-item">
                <span className="rule-icon">🔍</span>
                <span><strong>Verification:</strong> Sessions &gt;1h are flagged for admin review before counting toward your score.</span>
              </div>
            </div>
          </div>

          <div className="info-box">
            <h4>Scoring tip</h4>
            <div className="rule-list">
              <div className="rule-item">
                <span className="rule-icon">🔥</span>
                <span>Consecutive daily logs build your streak — up to a <strong>2×</strong> score multiplier at 10 days.</span>
              </div>
              <div className="rule-item">
                <span className="rule-icon">✅</span>
                <span>Only logs with <strong>approved exercises</strong> count toward your competition score.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
