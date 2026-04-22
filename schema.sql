-- ============================================================
-- FITNESS COMPETITION APP — PostgreSQL Schema
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Users ───────────────────────────────────────────────────
CREATE TABLE users (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  username      VARCHAR(50)   NOT NULL UNIQUE,
  password_hash TEXT          NOT NULL,
  is_admin      BOOLEAN       NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_username ON users (username);

-- ─── Exercises ───────────────────────────────────────────────
CREATE TABLE exercises (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(100) NOT NULL UNIQUE,
  is_approved BOOLEAN      NOT NULL DEFAULT FALSE,
  created_by  UUID         NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_exercises_approved ON exercises (is_approved);

-- ─── Logs ─────────────────────────────────────────────────────
CREATE TABLE logs (
  id                 UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID           NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  exercise_id        UUID           NOT NULL REFERENCES exercises (id) ON DELETE CASCADE,
  duration_hrs       NUMERIC(4, 2)  NOT NULL
                        CHECK (duration_hrs > 0 AND duration_hrs <= 4.0),
  timestamp          TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  needs_verification BOOLEAN        NOT NULL DEFAULT FALSE,
  verified_at        TIMESTAMPTZ,
  verified_by        UUID           REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX idx_logs_user_id         ON logs (user_id);
CREATE INDEX idx_logs_timestamp       ON logs (timestamp DESC);
CREATE INDEX idx_logs_needs_verify    ON logs (needs_verification) WHERE needs_verification = TRUE;
-- Composite index powers the 24-hr velocity check
CREATE INDEX idx_logs_user_timestamp  ON logs (user_id, timestamp DESC);

-- ─── Convenience view: approved logs with exercise name ───────
CREATE VIEW approved_logs_view AS
  SELECT
    l.id,
    l.user_id,
    u.username,
    e.id          AS exercise_id,
    e.name        AS exercise_name,
    l.duration_hrs,
    l.timestamp,
    l.needs_verification
  FROM logs           l
  JOIN users          u ON u.id = l.user_id
  JOIN exercises      e ON e.id = l.exercise_id
  WHERE e.is_approved = TRUE;
