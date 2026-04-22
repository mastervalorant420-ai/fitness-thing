// src/services/scoringService.js
// ─────────────────────────────────────────────────────────────────────────────
// Competition Score Formula:
//
//   Score = (Σ Approved_Duration × 100) × (1 + (Current_Streak × 0.1))
//
// Constraints:
//   • Only logs whose exercise.is_approved = true are counted.
//   • Streak multiplier caps at 2.0 (a 10-day streak).
//   • A "day" is defined as a calendar day in the user's submitted timestamps
//     (UTC).  Any number of approved logs on the same day counts as one streak
//     day.
// ─────────────────────────────────────────────────────────────────────────────
'use strict';

const { query } = require('./db');

const STREAK_BONUS_PER_DAY  = 0.1;
const MAX_STREAK_MULTIPLIER = 2.0;
const DURATION_MULTIPLIER   = 100;

/**
 * Compute the competition score for a single user.
 *
 * @param   {string} userId  UUID of the user
 * @returns {Promise<{ score: number, total_approved_hrs: number, streak: number }>}
 */
async function computeScore(userId) {
  // ── Fetch all approved logs for this user, newest first ──────────────────
  const { rows } = await query(
    `SELECT l.duration_hrs,
            DATE(l.timestamp AT TIME ZONE 'UTC') AS log_date
       FROM logs       l
       JOIN exercises  e ON e.id = l.exercise_id
      WHERE l.user_id     = $1
        AND e.is_approved = TRUE
      ORDER BY log_date DESC`,
    [userId]
  );

  if (rows.length === 0) {
    return { score: 0, total_approved_hrs: 0, streak: 0 };
  }

  // ── Total approved hours ──────────────────────────────────────────────────
  const total_approved_hrs = rows.reduce(
    (sum, row) => sum + parseFloat(row.duration_hrs),
    0
  );

  // ── Streak calculation ────────────────────────────────────────────────────
  // Collect unique active days (as ISO date strings), already sorted desc
  const uniqueDays = [...new Set(rows.map((r) => r.log_date.toISOString().slice(0, 10)))];

  const streak = calculateStreak(uniqueDays);

  // ── Cap the multiplier ────────────────────────────────────────────────────
  const multiplier = Math.min(1 + streak * STREAK_BONUS_PER_DAY, MAX_STREAK_MULTIPLIER);

  const score = parseFloat(
    (total_approved_hrs * DURATION_MULTIPLIER * multiplier).toFixed(2)
  );

  return { score, total_approved_hrs, streak };
}

/**
 * Calculate the current consecutive-day streak from an array of ISO date
 * strings sorted in descending order (most recent first).
 *
 * Rules:
 *   • The streak must include today OR yesterday (allows the user to log later
 *     today without breaking a streak from the day before).
 *   • Each calendar day counts at most once (multiple sessions = one day).
 *
 * @param   {string[]} sortedDaysDesc  e.g. ['2024-07-10', '2024-07-09', ...]
 * @returns {number}
 */
function calculateStreak(sortedDaysDesc) {
  if (sortedDaysDesc.length === 0) return 0;

  const today     = toUTCDateString(new Date());
  const yesterday = toUTCDateString(offsetDays(new Date(), -1));

  // Streak must start from today or yesterday — otherwise it's already broken
  const mostRecent = sortedDaysDesc[0];
  if (mostRecent !== today && mostRecent !== yesterday) return 0;

  let streak       = 1;
  let expectedDate = offsetDays(new Date(mostRecent + 'T00:00:00Z'), -1);

  for (let i = 1; i < sortedDaysDesc.length; i++) {
    const current = sortedDaysDesc[i];
    if (current === toUTCDateString(expectedDate)) {
      streak++;
      expectedDate = offsetDays(expectedDate, -1);
    } else {
      break; // gap detected — streak ends
    }
  }

  return streak;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toUTCDateString(date) {
  return date.toISOString().slice(0, 10);
}

function offsetDays(date, days) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

/**
 * Compute scores for ALL users and return them ranked highest first.
 * Used by GET /leaderboard.
 *
 * @returns {Promise<Array<{ user_id, username, score, total_approved_hrs, streak }>>}
 */
async function buildLeaderboard() {
  // Pull all distinct users who have at least one approved log
  const { rows: users } = await query(
    `SELECT DISTINCT u.id, u.username
       FROM users u
       JOIN logs      l ON l.user_id     = u.id
       JOIN exercises e ON e.id          = l.exercise_id
      WHERE e.is_approved = TRUE`,
    []
  );

  const entries = await Promise.all(
    users.map(async (u) => {
      const { score, total_approved_hrs, streak } = await computeScore(u.id);
      return { user_id: u.id, username: u.username, score, total_approved_hrs, streak };
    })
  );

  return entries.sort((a, b) => b.score - a.score);
}

module.exports = { computeScore, buildLeaderboard, calculateStreak };
