// server.js
// ─────────────────────────────────────────────────────────────────────────────
// Entry point.
// Wires together: Express → HTTP server → Socket.io → Routes
// ─────────────────────────────────────────────────────────────────────────────
'use strict';

require('dotenv').config();

const express       = require('express');
const http          = require('http');
const { Server }    = require('socket.io');
const rateLimit     = require('express-rate-limit');
const cors          = require('cors');

const createRouter  = require('./index');

// ── App bootstrap ─────────────────────────────────────────────────────────────
const app    = express();
const server = http.createServer(app);

// ── Socket.io ────────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_ORIGIN || '*',
    methods: ['GET', 'POST'],
  },
  // Tune transport — prefer WebSockets, fall back to polling
  transports: ['websocket', 'polling'],
});

// ── Socket.io connection handler ─────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[socket.io] client connected  id=${socket.id}`);

  // Clients can subscribe to a personal room for targeted notifications
  socket.on('JOIN_USER_ROOM', (userId) => {
    socket.join(`user:${userId}`);
    console.log(`[socket.io] ${socket.id} joined room user:${userId}`);
  });

  socket.on('disconnect', (reason) => {
    console.log(`[socket.io] client disconnected id=${socket.id} reason=${reason}`);
  });
});

// ── Global Express middleware ─────────────────────────────────────────────────

// Allow frontend app origins to call this API in browser environments.
app.use(cors({
  origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Parse JSON bodies; limit size to prevent payload attacks
app.use(express.json({ limit: '10kb' }));

// Remove fingerprinting header
app.disable('x-powered-by');

// Security headers (lightweight — use helmet in production)
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options',  'nosniff');
  res.setHeader('X-Frame-Options',         'DENY');
  res.setHeader('Referrer-Policy',         'no-referrer');
  next();
});

// Global rate limiter — tighter per-route limits can be added on sensitive endpoints
const globalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
  max:      parseInt(process.env.RATE_LIMIT_MAX,        10) || 100,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { error: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests. Please slow down.' },
});
app.use(globalLimiter);

// Stricter limiter on auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 20,
  message: { error: 'AUTH_RATE_LIMIT', message: 'Too many authentication attempts.' },
});
app.use('/auth', authLimiter);

// ── Routes ────────────────────────────────────────────────────────────────────
// Inject the `io` instance so route handlers can emit events
app.use('/', createRouter(io));

// ── Health check (useful for load-balancer probes) ────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'NOT_FOUND', message: 'The requested resource does not exist.' });
});

// ── Global error handler ──────────────────────────────────────────────────────
// Express identifies this as an error handler via the 4-param signature.
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  // Postgres unique-violation
  if (err.code === '23505') {
    return res.status(409).json({ error: 'CONFLICT', message: 'A duplicate record was detected.' });
  }
  // Postgres FK violation
  if (err.code === '23503') {
    return res.status(400).json({ error: 'INVALID_REFERENCE', message: 'Referenced record does not exist.' });
  }
  // Postgres check-constraint violation
  if (err.code === '23514') {
    return res.status(400).json({ error: 'CONSTRAINT_VIOLATION', message: err.detail || 'Data failed a database constraint.' });
  }

  console.error('[server] unhandled error:', err);

  const isDev = process.env.NODE_ENV !== 'production';
  return res.status(500).json({
    error:   'INTERNAL_ERROR',
    message: 'An unexpected error occurred.',
    ...(isDev && { detail: err.message, stack: err.stack }),
  });
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT, 10) || 3000;
server.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════════════════╗
  ║   🏋️  Fitness Competition Backend — RUNNING      ║
  ║   Port  : ${PORT}                                    ║
  ║   Mode  : ${(process.env.NODE_ENV || 'development').padEnd(11)}                       ║
  ╚══════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[server] SIGTERM received, shutting down gracefully…');
  server.close(() => {
    console.log('[server] HTTP server closed.');
    process.exit(0);
  });
});

module.exports = { app, server, io }; // exported for testing
