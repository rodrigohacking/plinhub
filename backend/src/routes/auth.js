const express = require('express');
const router = express.Router();
const passport = require('passport');
const FacebookStrategy = require('passport-facebook').Strategy;
const { encrypt } = require('../utils/encryption');
const prisma = require('../utils/prisma');
const metaAdsService = require('../services/metaAds.service');

// Configure Facebook Strategy
passport.use(new FacebookStrategy({
    clientID: process.env.META_APP_ID,
    clientSecret: process.env.META_APP_SECRET,
    callbackURL: process.env.META_REDIRECT_URI,
    profileFields: ['id', 'displayName', 'emails']
},
    async (accessToken, refreshToken, profile, done) => {
        return done(null, { profile, accessToken });
    }
));

passport.serializeUser((user, done) => {
    done(null, user);
});

passport.deserializeUser((user, done) => {
    done(null, user);
});

/**
 * Initiate Meta Ads OAuth flow
 * GET /api/auth/meta/connect?companyId=123
 */
router.get('/meta/connect', (req, res, next) => {
    const { companyId } = req.query;

    if (!companyId) {
        return res.status(400).json({ error: 'companyId is required' });
    }

    // Store companyId in session
    req.session.companyId = companyId;

    passport.authenticate('facebook', {
        scope: ['ads_read', 'ads_management', 'business_management']
    })(req, res, next);
});

/**
 * OAuth callback
 * GET /api/auth/meta/callback
 */
router.get('/meta/callback',
    passport.authenticate('facebook', { failureRedirect: '/auth/meta/error' }),
    async (req, res) => {
        try {
            const { accessToken } = req.user;
            const companyId = parseInt(req.session.companyId);

            if (!companyId) {
                throw new Error('Company ID not found in session');
            }

            // Get ad accounts
            const adAccounts = await metaAdsService.getAdAccounts(accessToken);

            if (adAccounts.length === 0) {
                return res.redirect(`${process.env.FRONTEND_URL}/?error=no_ad_accounts`);
            }

            // Use first ad account (or let user choose later)
            const adAccount = adAccounts[0];

            // Save integration
            await prisma.integration.upsert({
                where: {
                    companyId_type: {
                        companyId,
                        type: 'meta_ads'
                    }
                },
                update: {
                    metaAccessToken: encrypt(accessToken),
                    metaAdAccountId: adAccount.id,
                    metaAccountName: adAccount.name,
                    metaBusinessId: adAccount.business?.id,
                    metaStatus: adAccount.account_status === 1 ? 'active' : 'restricted',
                    metaTokenExpiry: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days
                    isActive: true
                },
                create: {
                    companyId,
                    type: 'meta_ads',
                    metaAccessToken: encrypt(accessToken),
                    metaAdAccountId: adAccount.id,
                    metaAccountName: adAccount.name,
                    metaBusinessId: adAccount.business?.id,
                    metaStatus: adAccount.account_status === 1 ? 'active' : 'restricted',
                    metaTokenExpiry: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
                    isActive: true
                }
            });

            // Redirect back to frontend
            res.redirect(`${process.env.FRONTEND_URL}/settings?meta_connected=true`);
        } catch (error) {
            console.error('OAuth callback error:', error);
            res.redirect(`${process.env.FRONTEND_URL}/settings?error=${encodeURIComponent(error.message)}`);
        }
    }
);

/**
 * Disconnect Meta Ads
 * POST /api/auth/meta/disconnect
 */
router.post('/meta/disconnect', async (req, res) => {
    try {
        const { companyId } = req.body;

        await prisma.integration.update({
            where: {
                companyId_type: {
                    companyId: parseInt(companyId),
                    type: 'meta_ads'
                }
            },
            data: {
                isActive: false,
                metaAccessToken: null
            }
        });

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
