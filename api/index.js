/**
 * KorriPay — Vercel Serverless Entry Point
 *
 * Vercel runs this file as the single serverless function.
 * It imports the Express app from the backend and exports it
 * as the default handler. All routing (`/.*`) is directed here
 * via vercel.json.
 *
 * The Express app itself serves:
 *   - GET /api/*           → backend REST API
 *   - GET /                → frontend/index.html
 *   - GET /dashboard, etc. → other HTML pages
 *   - GET /styles.css, etc.→ static frontend assets
 */

import { app } from '../backend/server.js';

export default app;
