export const config = {
    api: {
        bodyParser: {
            sizeLimit: '4mb',
        },
    },
};

export default async function handler(req, res) {
    // Helper for CORS
    const setCors = (res) => {
        res.setHeader('Access-Control-Allow-Credentials', true);
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
        res.setHeader(
            'Access-Control-Allow-Headers',
            'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
        );
    };

    setCors(res);

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const body = req.body; // Vercel parses JSON body auto in Node runtime

        // AUTH PRIORITY STRATEGY (CORRECTED)
        // 1. Client Token (User/Company specific) - PRIORITY
        // If the frontend sends a specific token (e.g. for a specific Client Company), use it.
        // The frontend only sends this header if it's valid (not undefined).
        let token = req.headers['authorization'];

        // 2. System Overlord Token (Env Var) - FALLBACK
        // Use this only if the client didn't provide one (e.g. Zero-Config authed by Admin).
        if (!token && process.env.PIPEFY_TOKEN) {
            token = process.env.PIPEFY_TOKEN.startsWith('Bearer ')
                ? process.env.PIPEFY_TOKEN
                : `Bearer ${process.env.PIPEFY_TOKEN}`;
        }

        // 3. OAuth2 Override (Last Resort / Alternative)
        // Only trigger if we still don't have a token OR we want to support OAuth flows explicitly
        if (!token) {
            const clientId = process.env.PIPEFY_CLIENT_ID;
            const clientSecret = process.env.PIPEFY_CLIENT_SECRET;

            if (clientId && clientSecret) {
                try {
                    const authRes = await fetch('https://app.pipefy.com/oauth/token', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            grant_type: 'client_credentials',
                            client_id: clientId,
                            client_secret: clientSecret
                        })
                    });

                    if (authRes.ok) {
                        const authData = await authRes.json();
                        token = `Bearer ${authData.access_token}`;
                    } else {
                        console.error('[Pipefy Proxy] OAuth Failed:', await authRes.text());
                    }
                } catch (authError) {
                    console.error('[Pipefy Proxy] OAuth Error:', authError);
                }
            }
        }

        if (!token) {
            return res.status(401).json({
                error: 'Missing Authorization',
                details: 'No PIPEFY_TOKEN env var, no Client Token, and no OAuth config found.'
            });
        }

        // Helper to perform fetch
        const doFetch = async (accessToken) => {
            return fetch('https://api.pipefy.com/graphql', {
                method: 'POST',
                headers: {
                    'Authorization': accessToken,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            });
        };

        // 1. Try with selected Candidate Token
        let pipefyRes = await doFetch(token);

        // 2. RETRY STRATEGY (Auto-Heal)
        // If 401 Unauthorized AND we have a System Token that is DIFFERENT from the one we just tried
        if (pipefyRes.status === 401 && process.env.PIPEFY_TOKEN) {
            const systemToken = process.env.PIPEFY_TOKEN.startsWith('Bearer ')
                ? process.env.PIPEFY_TOKEN
                : `Bearer ${process.env.PIPEFY_TOKEN}`;

            // Avoid infinite retry if we already used the system token
            if (token !== systemToken) {
                console.warn('[Pipefy Proxy] ⚠️ Client Token INVALID (401). Retrying with System Fallback...');
                pipefyRes = await doFetch(systemToken);
            }
        }

        const data = await pipefyRes.json();
        res.status(pipefyRes.status).json(data);

    } catch (error) {
        console.error('[Pipefy Proxy] Fatal Error:', error);
        res.status(500).json({
            error: {
                message: error.message,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            }
        });
    }
}
