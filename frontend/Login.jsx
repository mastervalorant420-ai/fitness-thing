// src/pages/Login.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';

export default function Login() {
  const { login, loading, error, clearError } = useAuth();
  const [form, setForm] = useState({ username: '', password: '' });

  useEffect(() => { clearError(); }, []);

  function handleChange(e) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    login(form.username, form.password);
  }

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
            Every rep<br /><em>counts.</em>
          </h2>
          <p className="auth-sub">
            Log your training. Track your streak. Rise on the leaderboard.
            Your best days are ahead of you.
          </p>
        </div>
        <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.2)' }}>
          © {new Date().getFullYear()} Apex Fitness
        </div>
      </div>

      {/* Right panel */}
      <div className="auth-panel-right">
        <div className="auth-form-box">
          <h2 className="auth-form-title display">Welcome back</h2>
          <p className="auth-form-sub">
            New here?{' '}
            <Link to="/register">Create an account</Link>
          </p>

          {error && (
            <div className="alert alert-error" style={{ marginBottom: '20px' }}>
              <span>⚠</span> {error}
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
                placeholder="your_username"
                value={form.username}
                onChange={handleChange}
                required
                autoFocus
              />
            </div>

            <div className="field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={form.password}
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
                <><span className="spinner"></span> Signing in…</>
              ) : (
                'Sign in →'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
