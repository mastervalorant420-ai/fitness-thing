# Frontend Context For Claude

Use this file as backend context when asking Claude to generate a frontend UI.

## Stack

- Backend: Node.js + Express
- Database: PostgreSQL
- Auth: JWT Bearer token
- Realtime: Socket.io

Base URL (local): `http://127.0.0.1:3000`

## Auth Model

- Login/register return `{ user, token }`.
- Send token as `Authorization: Bearer <token>` on protected routes.
- `user` includes: `id`, `username`, `is_admin`.

## API Endpoints

### Public

- `GET /health`
  - Response: `{ status: "ok", ts: "<iso-date>" }`

- `GET /leaderboard`
  - Response: `{ leaderboard: Array<LeaderboardEntry>, generated_at: "<iso-date>" }`

`LeaderboardEntry`:
- `user_id` (uuid)
- `username` (string)
- `score` (number)
- `total_approved_hrs` (number)
- `streak` (number)

### Auth

- `POST /auth/register`
  - Body: `{ username, password }`
  - Response: `{ user, token }`

- `POST /auth/login`
  - Body: `{ username, password }`
  - Response: `{ user, token }`

### User Logs (Protected)

- `POST /logs`
  - Auth required
  - Body: `{ exercise_id, duration_hrs }`
  - Response:
    - Success: `{ log: { id, exercise_id, exercise_name, duration_hrs, timestamp, needs_verification } }`
    - Validation errors include:
      - `INVALID_DURATION`
      - `MISSING_EXERCISE`
      - `HARD_CAP_EXCEEDED`
      - `PHYSICAL_LIMIT_REACHED`

### Admin (Protected + is_admin=true)

- `PATCH /admin/approve-exercise`
  - Body: `{ exercise_id }`
  - Response: `{ exercise }`

- `PATCH /admin/verify-log`
  - Body: `{ log_id }`
  - Response: `{ log }`

- `GET /admin/pending-logs`
  - Response: `{ pending_logs: Array<PendingLog> }`

## Realtime Events (Socket.io)

Server emits:

- `GLOBAL_ACTIVITY`
  - Payload: `{ username, exercise_name, duration_hrs, timestamp, flagged }`

- `LOG_VERIFIED`
  - Payload: `{ log_id, verified_by }`

Client can emit:

- `JOIN_USER_ROOM`
  - Payload: `userId`

## Suggested Frontend Screens

- Login / Register
- Leaderboard
- Add Activity Log form
- Activity feed (listen to `GLOBAL_ACTIVITY`)
- Admin panel (only if `user.is_admin`)
  - Approve exercise
  - Pending logs
  - Verify log

## Notes For Claude

- Use a central API client with token injection.
- Handle 401 by redirecting to login and clearing token.
- Keep role-based route guards for admin screens.
- Display backend error codes/messages from response JSON.
