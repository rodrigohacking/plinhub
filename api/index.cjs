// Vercel Serverless Function Wrapper
// This file wraps the Express app for Vercel's serverless environment

const app = require('../backend/src/server.js');

// Export the Express app as a serverless function
module.exports = app;
