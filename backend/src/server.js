const path = require('path');
// Load .env from root (../../.env relative to src/server.js)
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
// Also try loading local .env for overrides
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const session = require('express-session');
const passport = require('passport');
const axios = require('axios');

// Patch BigInt serialization
BigInt.prototype.toJSON = function () {
    const int = Number.parseInt(this.toString());
    return Number.isSafeInteger(int) ? int : this.toString();
};

// Routes
const authRoutes = require('./routes/auth');
const integrationRoutes = require('./routes/integrations');
const metricsRoutes = require('./routes/metrics');
const goalsRoutes = require('./routes/goals'); // Restore this
const syncRoutes = require('./routes/sync');
const companyRoutes = require('./routes/companies');
const campaignsRoutes = require('./routes/campaigns'); // New Route

// Jobs
const { startCronJobs } = require('./jobs/dailySync.cron');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Passport initialization
app.use(passport.initialize());
app.use(passport.session());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/integrations', integrationRoutes);
app.use('/api/metrics', metricsRoutes);
app.use('/api/goals', goalsRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/campaigns', campaignsRoutes);
app.use('/api/invites', require('./routes/invite'));
// Removed duplicate goalsRoutes usage

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Proxy Route for Pipefy (Bypassing CORS + Backend OAuth Injection)
app.post('/api/pipefy', async (req, res) => {
    try {
        const { query, variables } = req.body;
        // Check for Backend Auth Config
        // Check for Backend Auth Config
        const clientId = process.env.PIPEFY_CLIENT_ID;
        const clientSecret = process.env.PIPEFY_CLIENT_SECRET;
        const systemToken = process.env.PIPEFY_TOKEN ? (process.env.PIPEFY_TOKEN.startsWith('Bearer ') ? process.env.PIPEFY_TOKEN : `Bearer ${process.env.PIPEFY_TOKEN}`) : null;

        // AUTH PRIORITY STRATEGY (Vercel Consistent)
        // 1. Client Token (User/Company specific) - PRIORITY
        let token = req.headers.authorization?.replace('Bearer ', '');
        if (token && token.toLowerCase() !== 'undefined' && token.toLowerCase() !== 'null') {
            // Keep it (it's valid)
        } else {
            token = null;
        }

        // 2. System Overlord Token (Env Var) - FALLBACK
        if (!token && systemToken) {
            token = systemToken.replace('Bearer ', '');
        }

        if (!query) {
            return res.status(400).json({ error: 'Missing GraphQL query in body' });
        }

        // Helper to perform fetch
        const doFetch = async (accessToken) => {
            if (!accessToken) throw new Error('No access token provided');

            const authHeader = accessToken.startsWith('Bearer ') ? accessToken : `Bearer ${accessToken}`;

            return axios.post('https://api.pipefy.com/graphql',
                { query, variables },
                {
                    headers: {
                        'Authorization': authHeader,
                        'Content-Type': 'application/json'
                    }
                }
            );
        };

        let response;
        try {
            // 1. Try with Candidate Token
            response = await doFetch(token);
        } catch (initialErr) {
            // 2. RETRY STRATEGY
            if (initialErr.response?.status === 401 && systemToken && token !== systemToken.replace('Bearer ', '')) {
                console.warn('[Proxy] ⚠️ Client Token INVALID (401). Retrying with System Fallback...');
                try {
                    response = await doFetch(systemToken);
                } catch (retryErr) {
                    // Retry failed too? Throw the retry error (likely original was correct, token is just bad everywhere)
                    throw retryErr;
                }
            } else {
                throw initialErr; // Not 401, or no system token to try
            }
        }

        res.json(response.data);
    } catch (error) {
        // Detailed Error Logging
        const status = error.response?.status || 500;
        const data = error.response?.data || error.message;

        console.error(`[Pipefy Proxy] Error ${status}:`, JSON.stringify(data).slice(0, 300));

        res.status(status).json({
            error: {
                message: 'Pipefy API Error',
                originalError: data
            }
        });
    }
});

// Error handling
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({
        error: {
            message: err.message || 'Internal Server Error',
            ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
        }
    });
});

// Start server only if run directly (local dev), not when imported by Vercel
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`🚀 Server running on http://localhost:${PORT}`);
        console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);

        // Start cron jobs
        if (process.env.ENABLE_CRON === 'true') {
            startCronJobs();
            console.log('⏰ Cron jobs started');
        }
    });
}

module.exports = app;
