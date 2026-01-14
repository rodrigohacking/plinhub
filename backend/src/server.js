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

// Patch BigInt serialization
BigInt.prototype.toJSON = function () {
    const int = Number.parseInt(this.toString());
    return Number.isSafeInteger(int) ? int : this.toString();
};

// Routes
const authRoutes = require('./routes/auth');
const integrationRoutes = require('./routes/integrations');
const metricsRoutes = require('./routes/metrics');
const syncRoutes = require('./routes/sync');
const companyRoutes = require('./routes/companies');

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
app.use('/api/sync', syncRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/invites', require('./routes/invite'));

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Proxy Route for Pipefy (Bypassing CORS)
const axios = require('axios');
app.post('/api/pipefy', async (req, res) => {
    console.log('[Proxy] Incoming Query size:', req.body.query?.length);
    try {
        const { query } = req.body;
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            console.warn('[Proxy] Missing Auth Header');
            return res.status(401).json({ error: 'Missing Authorization header' });
        }

        const response = await axios.post('https://api.pipefy.com/graphql',
            { query },
            {
                headers: {
                    'Authorization': authHeader,
                    'Content-Type': 'application/json'
                }
            }
        );

        res.json(response.data);
    } catch (error) {
        console.error('Pipefy Proxy Error:', error.message);
        if (error.response) {
            console.error('Pipefy Response Data:', JSON.stringify(error.response.data).slice(0, 200));
        }

        res.status(error.response?.status || 500).json({
            error: {
                message: error.message,
                details: error.response?.data,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
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
