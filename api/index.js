// Vercel Serverless Entry Point for KorriPay
// This file imports the Express app from server.js and exports it
// as the default handler for Vercel's serverless function runtime.

import { app } from '../backend/server.js';

export default app;
