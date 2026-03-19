const axios = require('axios');
const supabase = require('../utils/supabase');
const { encrypt, decrypt } = require('../utils/encryption');

const META_OAUTH_URL = 'https://graph.facebook.com/oauth/access_token';

function safeDecrypt(token) {
    if (!token) return null;
    try {
        return decrypt(token);
    } catch (e) {
        return token;
    }
}

function shouldRefresh(expiryIso, bufferDays = 10) {
    if (!expiryIso) return true;
    const expiry = new Date(expiryIso).getTime();
    if (Number.isNaN(expiry)) return true;
    const now = Date.now();
    const bufferMs = bufferDays * 24 * 60 * 60 * 1000;
    return expiry - now <= bufferMs;
}

async function exchangeForLongLivedToken(token) {
    if (!process.env.META_APP_ID || !process.env.META_APP_SECRET) {
        return { accessToken: token, expiresIn: null, exchanged: false, error: 'META app credentials missing' };
    }

    try {
        const response = await axios.get(META_OAUTH_URL, {
            params: {
                grant_type: 'fb_exchange_token',
                client_id: process.env.META_APP_ID,
                client_secret: process.env.META_APP_SECRET,
                fb_exchange_token: token
            }
        });

        return {
            accessToken: response.data.access_token,
            expiresIn: response.data.expires_in,
            exchanged: true
        };
    } catch (error) {
        const msg = error.response?.data?.error?.message || error.message;
        return { accessToken: token, expiresIn: null, exchanged: false, error: msg };
    }
}

async function ensureValidMetaToken(integration, bufferDays = 10) {
    if (!integration || !integration.metaAccessToken) {
        return { accessToken: null, refreshed: false, error: 'Missing meta token' };
    }

    const currentToken = safeDecrypt(integration.metaAccessToken);
    const needsRefresh = shouldRefresh(integration.metaTokenExpiry, bufferDays);

    if (!needsRefresh) {
        return { accessToken: currentToken, refreshed: false };
    }

    const exchanged = await exchangeForLongLivedToken(currentToken);
    const newToken = exchanged.accessToken || currentToken;

    if (exchanged.exchanged && integration.id) {
        const expiryIso = exchanged.expiresIn
            ? new Date(Date.now() + exchanged.expiresIn * 1000).toISOString()
            : null;

        await supabase
            .from('Integration')
            .update({
                metaAccessToken: encrypt(newToken),
                metaTokenExpiry: expiryIso,
                updatedAt: new Date().toISOString()
            })
            .eq('id', integration.id);
    }

    return {
        accessToken: newToken,
        refreshed: exchanged.exchanged,
        error: exchanged.error
    };
}

module.exports = {
    ensureValidMetaToken,
    exchangeForLongLivedToken,
    safeDecrypt
};
