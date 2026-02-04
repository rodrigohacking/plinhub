// Vercel Serverless Function Wrapper
// This file wraps the Express app for Vercel's serverless environment

import app from '../backend/src/server.js';

// Export the Express app as a serverless function
export default app;
