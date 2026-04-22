// src/components/Layout.jsx
import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';

function NavItem({ to, icon, label }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
    >
      <span className="icon">{icon}</span>
      {label}
    </NavLink>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const initials = user?.username?.slice(0, 2).toUpperCase() || '??';

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <h1 className="display">Apex<span>.</span></h1>
          <p className="sidebar-tagline">Fitness Competition</p>
        </div>

        <nav className="sidebar-nav">
          <span className="nav-section-label">Compete</span>
          <NavItem to="/leaderboard" icon="🏆" label="Leaderboard" />
          <NavItem to="/feed"        icon="⚡" label="Live Feed" />

          <span className="nav-section-label">Train</span>
          <NavItem to="/log"         icon="✚" label="Log Workout" />

          {user?.is_admin && (
            <>
              <span className="nav-section-label">Admin</span>
              <NavItem to="/admin" icon="🛡" label="Admin Panel" />
            </>
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="user-chip">
            <div className="user-avatar">{initials}</div>
            <span className="user-name">{user?.username}</span>
            <button
              className="logout-btn"
              onClick={logout}
              title="Sign out"
              aria-label="Sign out"
            >
              ↗
            </button>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
