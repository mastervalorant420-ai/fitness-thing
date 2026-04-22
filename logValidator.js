// src/middleware/logValidator.js
// ─────────────────────────────────────────────────────────────────────────────
// The Guard Layer for POST /logs
//
// Rules (executed in order — first failure short-circuits):
//   1. Hard Cap        — duration_hrs must be in (0, 4.0]
//   2. Precision Fix   — round to the nearest 0.25 (15-min increment)
//   3. Velocity Check  — user's rolling 24-hr total must not exceed 8.0 hrs
//   4. Verification    — flag the log if duration_hrs > 1.0
// ─────────────────────────────────────────────────────────────────────────────
'use strict';

const { query } = require('./db');

// ── Constants ────────────────────────────────────────────────────────────────
const HARD_CAP_HRS        = 4.0;
const DAILY_LIMIT_HRS     = 8.0;
const PRECISION_INCREMENT = 0.25;
const VERIFICATION_FLOOR  = 1.0;

/**
 * Round `value` to the nearest `increment`.
 * e.g. snap(1.1, 0.25) → 1.0   |  snap(1.13, 0.25) → 1.25
 */
function snapToIncrement(value, increment) {
  return Math.round(value / increment) * increment;
}

/**
 * Express middleware.
 * Attaches `req.validatedLog = { duration_hrs, needs_verification }` on success.
 */
async function logValidator(req, res, next) {
  try {
    let { duration_hrs, exercise_id } = req.body;
    const userId = req.user.id; // populated by authenticateToken middleware

    // ── Basic type coercion ───────────────────────────────────────────────
    duration_hrs = parseFloat(duration_hrs);
    if (isNaN(duration_hrs) || duration_hrs <= 0) {
      return res.status(400).json({
        error: 'INVALID_DURATION',
        message: 'duration_hrs must be a positive number.',
      });
    }

    if (!exercise_id) {
      return res.status(400).json({
        error: 'MISSING_EXERCISE',
        message: 'exercise_id is required.',
      });
    }

    // ── Rule 1: Hard Cap ─────────────────────────────────────────────────
    if (duration_hrs > HARD_CAP_HRS) {
      return res.status(400).json({
        error:   'HARD_CAP_EXCEEDED',
        message: `A single session cannot exceed ${HARD_CAP_HRS} hours.`,
        submitted: duration_hrs,
        cap:       HARD_CAP_HRS,
      });
    }

    // ── Rule 2: Precision Fix ────────────────────────────────────────────
    const snapped = parseFloat(snapToIncrement(duration_hrs, PRECISION_INCREMENT).toFixed(2));
    if (snapped !== duration_hrs) {
      // We silently correct rather than reject — caller sees the adjusted value
      duration_hrs = snapped;
    }

    // ── Rule 3: Velocity Check (24-hr rolling window) ────────────────────
    const velocityResult = await query(
      `SELECT COALESCE(SUM(duration_hrs), 0)::FLOAT AS total_hrs
         FROM logs
        WHERE user_id = $1
          AND timestamp >= NOW() - INTERVAL '24 hours'`,
      [userId]
    );
    const existing24hrTotal = velocityResult.rows[0].total_hrs;
    const projectedTotal    = existing24hrTotal + duration_hrs;

    if (projectedTotal > DAILY_LIMIT_HRS) {
      return res.status(429).json({
        error:           'PHYSICAL_LIMIT_REACHED',
        message:         'You have reached your 24-hour activity limit of 8 hours.',
        logged_today:    existing24hrTotal,
        requested:       duration_hrs,
        projected_total: projectedTotal,
        limit:           DAILY_LIMIT_HRS,
      });
    }

    // ── Rule 4: Verification Trigger ─────────────────────────────────────
    const needs_verification = duration_hrs > VERIFICATION_FLOOR;

    // ── Attach validated, corrected values to the request ─────────────────
    req.validatedLog = { duration_hrs, needs_verification };
    next();
  } catch (err) {
    console.error('[logValidator] unexpected error:', err);
    next(err);
  }
}

module.exports = logValidator;
