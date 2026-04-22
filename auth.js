// src/middleware/auth.js
'use strict';

const jwt = require('jsonwebtoken');

/**
 * Verifies the Bearer JWT and attaches `req.user = { id, username, is_admin }`.
 */
function authenticateToken(req, res, next) {
  const header = req.headers['authorization'];
  const token  = header && header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'MISSING_TOKEN', message: 'Authorization header required.' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.sub, username: payload.username, is_admin: payload.is_admin };
    next();
  } catch (err) {
    const expired = err.name === 'TokenExpiredError';
    return res.status(401).json({
      error:   expired ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN',
      message: expired ? 'Your session has expired. Please log in again.' : 'Invalid token.',
    });
  }
}

/**
 * Must be used after `authenticateToken`.
 * Rejects non-admin callers with 403.
 */
function requireAdmin(req, res, next) {
  if (!req.user?.is_admin) {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'Admin access required.' });
  }
  next();
}

module.exports = { authenticateToken, requireAdmin };
