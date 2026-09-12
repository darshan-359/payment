// server.js — QuorumGuard backend entry point
// Security: helmet for HTTP headers, CORS locked to frontend origin, rate limiting in routes.

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// --- Security middleware ---
// helmet sets secure HTTP response headers
app.use(helmet());

// CORS locked to the frontend's origin — not wildcard *
app.use(cors({
  origin: FRONTEND_URL,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
}));

app.use(express.json({ limit: '10kb' })); // Limit body size to prevent DoS

// --- Initialize database on startup ---
const { getDb } = require('./database');
getDb(); // Triggers schema creation

// --- Mount routes ---
app.use('/api', routes);

// --- Structured error handler (never leaks stack traces to client) ---
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message, err.stack); // Log detail server-side only
  res.status(500).json({ error: 'An internal error occurred. Please try again.' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found.' });
});

app.listen(PORT, () => {
  console.log(`QuorumGuard backend running on http://localhost:${PORT}`);
  console.log(`Accepting requests from: ${FRONTEND_URL}`);
});

module.exports = app;
