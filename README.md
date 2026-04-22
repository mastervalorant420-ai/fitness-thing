# Fitness Competition Backend

A hardened **Node.js / Express / PostgreSQL / Socket.io** backend for a
real-time fitness competition app.

---

## Project Structure

```
fitness app thing/
├── server.js                        # Entry-point — Express + Socket.io wiring
├── index.js                         # All route handlers (factory receives `io`)
├── db.js                            # pg Pool singleton
├── auth.js                          # authenticateToken + requireAdmin
├── logValidator.js                  # The Guard Layer (4 rules)
├── scoringService.js                # Score formula + streak engine
├── schema.sql                       # PostgreSQL DDL (run once)
├── package.json
└── .env.example
```

---

## Quick Start

```bash
cp .env.example .env          # fill in DATABASE_URL and JWT_SECRET
npm install
psql $DATABASE_URL -f schema.sql
npm run dev
```

---

## API Reference

### Auth

| Method | Path              | Auth | Body                        | Notes                        |
|--------|-------------------|------|-----------------------------|------------------------------|
| POST   | /auth/register    | —    | `{ username, password }`    | Returns `{ user, token }`    |
| POST   | /auth/login       | —    | `{ username, password }`    | Returns `{ user, token }`    |

### Public

| Method | Path              | Auth | Notes                                          |
|--------|-------------------|------|------------------------------------------------|
| GET    | /leaderboard      | —    | Users ranked by Competition Score              |
| GET    | /health           | —    | Load-balancer probe                            |

### Logs

| Method | Path   | Auth | Body                                  | Notes                          |
|--------|--------|------|---------------------------------------|--------------------------------|
| POST   | /logs  | JWT  | `{ exercise_id, duration_hrs }`       | Guard Layer runs first         |

### Admin

| Method | Path                      | Auth         | Body              |
|--------|---------------------------|--------------|-------------------|
| PATCH  | /admin/approve-exercise   | JWT + Admin  | `{ exercise_id }` |
| PATCH  | /admin/verify-log         | JWT + Admin  | `{ log_id }`      |
| GET    | /admin/pending-logs       | JWT + Admin  | —                 |

---

## The Guard Layer — `LogValidator`

Runs as Express middleware before any database write.

```
Incoming POST /logs
        │
        ▼
[1] Hard Cap Check
    duration_hrs > 4.0?  ──YES──► 400 HARD_CAP_EXCEEDED
        │
        ▼
[2] Precision Fix
    Snap to nearest 0.25
    (silent correction)
        │
        ▼
[3] Velocity Check (DB query)
    user_24hr_total + duration_hrs > 8.0?
                     ──YES──► 429 PHYSICAL_LIMIT_REACHED
        │
        ▼
[4] Verification Flag
    duration_hrs > 1.0 → needs_verification = true
        │
        ▼
    Insert log + broadcast GLOBAL_ACTIVITY via Socket.io
```

---

## Competition Score Formula

```
Score = (Σ Approved_Duration × 100) × (1 + min(streak, 10) × 0.1)
```

- Only logs whose `exercise.is_approved = true` are counted.
- **Streak** = current consecutive calendar days with ≥ 1 approved log.
- Streak multiplier is capped at **2.0** (10 consecutive days).

| Streak | Multiplier |
|--------|-----------|
| 0      | 1.0×      |
| 5      | 1.5×      |
| 10+    | 2.0× (cap)|

---

## Real-Time Events (Socket.io)

| Event             | Direction       | Payload                                                 |
|-------------------|-----------------|---------------------------------------------------------|
| `GLOBAL_ACTIVITY` | Server → All    | `{ username, exercise_name, duration_hrs, timestamp, flagged }` |
| `LOG_VERIFIED`    | Server → All    | `{ log_id, verified_by }`                               |
| `JOIN_USER_ROOM`  | Client → Server | `userId` — subscribes to personal room                  |

### Client example

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000');

socket.on('GLOBAL_ACTIVITY', ({ username, exercise_name, duration_hrs, flagged }) => {
  console.log(`${username} logged ${duration_hrs}h of ${exercise_name}${flagged ? ' ⚠️' : ''}`);
});

// Subscribe to personal notifications
socket.emit('JOIN_USER_ROOM', myUserId);
```

---

## Security Notes

- Passwords hashed with **bcrypt** (12 rounds).
- Timing-safe login: bcrypt runs even when the username is not found.
- JWT signed with HS256; secret must be ≥ 32 random characters.
- Global rate limit: 100 req / 15 min; auth endpoints: 20 req / 15 min.
- `X-Powered-By` header removed.
- JSON body capped at **10 KB** to prevent payload attacks.
- DB constraint `duration_hrs CHECK (> 0 AND <= 4.0)` provides a second layer
  of enforcement below the application guard.
