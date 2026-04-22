// src/App.jsx
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './AuthContext.jsx';
import { ProtectedRoute, AdminRoute } from './ProtectedRoute.jsx';
import Layout from './Layout.jsx';
import Login from './Login.jsx';
import Register from './Register.jsx';
import Leaderboard from './Leaderboard.jsx';
import LogWorkout from './LogWorkout.jsx';
import Feed from './Feed.jsx';
import Admin from './Admin.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/login"    element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Protected routes — require auth */}
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/leaderboard" element={<Leaderboard />} />
              <Route path="/log"         element={<LogWorkout />} />
              <Route path="/feed"        element={<Feed />} />

              {/* Admin-only */}
              <Route element={<AdminRoute />}>
                <Route path="/admin" element={<Admin />} />
              </Route>
            </Route>
          </Route>

          {/* Fallback → leaderboard (auth guard will redirect to /login if needed) */}
          <Route path="*" element={<Navigate to="/leaderboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
