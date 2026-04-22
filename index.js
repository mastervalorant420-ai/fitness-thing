// index.js
// ─────────────────────────────────────────────────────────────────────────────
// All route handlers.  The Socket.io `io` instance is injected via the factory
// so that log insertion can broadcast GLOBAL_ACTIVITY events.
// ─────────────────────────────────────────────────────────────────────────────
'use strict';

const express    = require('express');
const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');
const { query }  = require('./db');
const { authenticateToken, requireAdmin } = require('./auth');
const logValidator   = require('./logValidator');
const { buildLeaderboard } = require('./scoringService');

const SALT_ROUNDS = 12;

/**
 * @param {import('socket.io').Server} io
 */
function createRouter(io) {
  const router = express.Router();

  // ═══════════════════════════════════════════════════════════════════════════
  // AUTH
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * POST /auth/register
   * Body: { username, password }
   */
  router.post('/auth/register', async (req, res, next) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ error: 'MISSING_FIELDS', message: 'username and password are required.' });
      }
      if (username.length < 3 || username.length > 50) {
        return res.status(400).json({ error: 'INVALID_USERNAME', message: 'Username must be 3–50 characters.' });
      }
      if (password.length < 8) {
        return res.status(400).json({ error: 'WEAK_PASSWORD', message: 'Password must be at least 8 characters.' });
      }

      // Check uniqueness
      const existing = await query('SELECT id FROM users WHERE username = $1', [username]);
      if (existing.rowCount > 0) {
        return res.status(409).json({ error: 'USERNAME_TAKEN', message: 'That username is already registered.' });
      }

      const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
      const result = await query(
        'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username, is_admin, created_at',
        [username, password_hash]
      );

      const user  = result.rows[0];
      const token = signToken(user);

      return res.status(201).json({ user: sanitizeUser(user), token });
    } catch (err) {
      next(err);
    }
  });

  /**
   * POST /auth/login
   * Body: { username, password }
   */
  router.post('/auth/login', async (req, res, next) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ error: 'MISSING_FIELDS', message: 'username and password are required.' });
      }

      const result = await query(
        'SELECT id, username, password_hash, is_admin FROM users WHERE username = $1',
        [username]
      );

      // Constant-time-ish: always run bcrypt even if user not found
      const user         = result.rows[0];
      const dummyHash    = '$2a$12$invalidhashplaceholderXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
      const hashToCheck  = user ? user.password_hash : dummyHash;
      const match        = await bcrypt.compare(password, hashToCheck);

      if (!user || !match) {
        return res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Incorrect username or password.' });
      }

      const token = signToken(user);
      return res.json({ user: sanitizeUser(user), token });
    } catch (err) {
      next(err);
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // LEADERBOARD
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * GET /leaderboard
   * Public endpoint — returns users ranked by competition score.
   */
  router.get('/leaderboard', async (req, res, next) => {
    try {
      const board = await buildLeaderboard();
      return res.json({ leaderboard: board, generated_at: new Date().toISOString() });
    } catch (err) {
      next(err);
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // LOGS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * POST /logs
   * Protected + Guard Layer middleware.
   * Body: { exercise_id, duration_hrs }
   *
   * On success, broadcasts GLOBAL_ACTIVITY to all Socket.io clients.
   */
  router.post(
    '/logs',
    authenticateToken,
    logValidator,          // ← The Guard Layer runs here
    async (req, res, next) => {
      try {
        const { exercise_id }              = req.body;
        const { duration_hrs, needs_verification } = req.validatedLog;
        const userId                       = req.user.id;

        // Verify exercise exists
        const exerciseResult = await query(
          'SELECT id, name FROM exercises WHERE id = $1',
          [exercise_id]
        );
        if (exerciseResult.rowCount === 0) {
          return res.status(404).json({ error: 'EXERCISE_NOT_FOUND', message: 'No such exercise.' });
        }
        const exercise = exerciseResult.rows[0];

        // Insert log
        const logResult = await query(
          `INSERT INTO logs (user_id, exercise_id, duration_hrs, needs_verification)
             VALUES ($1, $2, $3, $4)
             RETURNING id, duration_hrs, timestamp, needs_verification`,
          [userId, exercise_id, duration_hrs, needs_verification]
        );
        const log = logResult.rows[0];

        // ── Broadcast GLOBAL_ACTIVITY ──────────────────────────────────────
        const activityPayload = {
          username:      req.user.username,
          exercise_name: exercise.name,
          duration_hrs:  parseFloat(log.duration_hrs),
          timestamp:     log.timestamp,
          flagged:       log.needs_verification,
        };
        io.emit('GLOBAL_ACTIVITY', activityPayload);

        return res.status(201).json({
          log: {
            id:                log.id,
            exercise_id,
            exercise_name:     exercise.name,
            duration_hrs:      parseFloat(log.duration_hrs),
            timestamp:         log.timestamp,
            needs_verification: log.needs_verification,
          },
        });
      } catch (err) {
        next(err);
      }
    }
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // ADMIN
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * PATCH /admin/approve-exercise
   * Body: { exercise_id }
   * Approves an exercise so its associated logs count toward scores.
   */
  router.patch(
    '/admin/approve-exercise',
    authenticateToken,
    requireAdmin,
    async (req, res, next) => {
      try {
        const { exercise_id } = req.body;
        if (!exercise_id) {
          return res.status(400).json({ error: 'MISSING_EXERCISE_ID' });
        }

        const result = await query(
          `UPDATE exercises
              SET is_approved = TRUE
            WHERE id = $1
            RETURNING id, name, is_approved`,
          [exercise_id]
        );

        if (result.rowCount === 0) {
          return res.status(404).json({ error: 'EXERCISE_NOT_FOUND' });
        }

        return res.json({ exercise: result.rows[0] });
      } catch (err) {
        next(err);
      }
    }
  );

  /**
   * PATCH /admin/verify-log
   * Body: { log_id }
   * Clears the needs_verification flag on a log after manual review.
   */
  router.patch(
    '/admin/verify-log',
    authenticateToken,
    requireAdmin,
    async (req, res, next) => {
      try {
        const { log_id } = req.body;
        if (!log_id) {
          return res.status(400).json({ error: 'MISSING_LOG_ID' });
        }

        const result = await query(
          `UPDATE logs
              SET needs_verification = FALSE,
                  verified_at        = NOW(),
                  verified_by        = $2
            WHERE id = $1
            RETURNING id, user_id, duration_hrs, needs_verification, verified_at`,
          [log_id, req.user.id]
        );

        if (result.rowCount === 0) {
          return res.status(404).json({ error: 'LOG_NOT_FOUND' });
        }

        // Notify all clients that a previously flagged log was cleared
        io.emit('LOG_VERIFIED', { log_id, verified_by: req.user.username });

        return res.json({ log: result.rows[0] });
      } catch (err) {
        next(err);
      }
    }
  );

  /**
   * GET /admin/pending-logs
   * Returns all logs awaiting admin verification.
   */
  router.get(
    '/admin/pending-logs',
    authenticateToken,
    requireAdmin,
    async (req, res, next) => {
      try {
        const { rows } = await query(
          `SELECT l.id, u.username, e.name AS exercise_name,
                  l.duration_hrs, l.timestamp, l.needs_verification
             FROM logs      l
             JOIN users     u ON u.id = l.user_id
             JOIN exercises e ON e.id = l.exercise_id
            WHERE l.needs_verification = TRUE
            ORDER BY l.timestamp DESC`,
          []
        );
        return res.json({ pending_logs: rows });
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function signToken(user) {
  return jwt.sign(
    { sub: user.id, username: user.username, is_admin: user.is_admin },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

function sanitizeUser(user) {
  const { password_hash, ...safe } = user;
  return safe;
}

module.exports = createRouter;
