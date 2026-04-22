// src/pages/Register.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';

export default function Register() {
  const { register, loading, error, clearError } = useAuth();
  const [form, setForm] = useState({ username: '', password: '', confirm: '' });
  const [local, setLocal] = useState('');

  useEffect(() => { clearError(); }, []);

  function handleChange(e) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setLocal('');
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (form.password !== form.confirm) {
      setLocal('Passwords do not match.');
      return;
    }
    register(form.username, form.password);
  }

  const displayError = local || error;

  return (
    <div className="auth-shell">
      {/* Left panel */}
      <div className="auth-panel-left">
        <div className="auth-brand">
          <h1 className="display">Apex<span>.</span></h1>
          <p>Fitness Competition</p>
        </div>
        <div>
          <h2 className="auth-headline">
            Start your<br /><em>journey.</em>
          </h2>
          <p className="auth-sub">
            Build consistency. Earn your streak multiplier.
            Compete against the best — starting with yesterday's you.
          </p>
        </div>
        <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.2)' }}>
          © {new Date().getFullYear()} Apex Fitness
        </div>
      </div>

      {/* Right panel */}
      <div className="auth-panel-right">
        <div className="auth-form-box">
          <h2 className="auth-form-title display">Create account</h2>
          <p className="auth-form-sub">
            Already competing?{' '}
            <Link to="/login">Sign in</Link>
          </p>

          {displayError && (
            <div className="alert alert-error" style={{ marginBottom: '20px' }}>
              <span>⚠</span> {displayError}
            </div>
          )}

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="username">Username</label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                placeholder="choose_a_name"
                value={form.username}
                onChange={handleChange}
                required
                autoFocus
                minLength={3}
                maxLength={50}
              />
              <span className="field-hint">3–50 characters</span>
            </div>

            <div className="field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                placeholder="min. 8 characters"
                value={form.password}
                onChange={handleChange}
                required
                minLength={8}
              />
            </div>

            <div className="field">
              <label htmlFor="confirm">Confirm password</label>
              <input
                id="confirm"
                name="confirm"
                type="password"
                autoComplete="new-password"
                placeholder="repeat password"
                value={form.confirm}
                onChange={handleChange}
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-full"
              disabled={loading}
              style={{ marginTop: '8px', padding: '14px' }}
            >
              {loading ? (
                <><span className="spinner"></span> Creating account…</>
              ) : (
                'Join the competition →'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
