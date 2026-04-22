// src/context/AuthContext.jsx
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, onUnauthorized } from './client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const navigate = useNavigate();

  const [user, setUser]       = useState(() => {
    try { return JSON.parse(localStorage.getItem('user')); }
    catch { return null; }
  });
  const [token, setToken]     = useState(() => localStorage.getItem('token'));
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const persist = (u, t) => {
    setUser(u); setToken(t);
    localStorage.setItem('user', JSON.stringify(u));
    localStorage.setItem('token', t);
  };

  const logout = useCallback(() => {
    setUser(null); setToken(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    navigate('/login', { replace: true });
  }, [navigate]);

  // Wire up the 401 listener once
  useEffect(() => {
    onUnauthorized(logout);
  }, [logout]);

  async function login(username, password) {
    setLoading(true); setError(null);
    try {
      const { user: u, token: t } = await api.post('/auth/login', { username, password });
      persist(u, t);
      navigate(u.is_admin ? '/admin' : '/leaderboard', { replace: true });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function register(username, password) {
    setLoading(true); setError(null);
    try {
      const { user: u, token: t } = await api.post('/auth/register', { username, password });
      persist(u, t);
      navigate('/leaderboard', { replace: true });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function clearError() { setError(null); }

  return (
    <AuthContext.Provider value={{ user, token, loading, error, login, register, logout, clearError }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
