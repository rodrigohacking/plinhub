export const config = {
    runtime: 'edge', // Optional: Use Edge for speed, or default Node
};

export default async function handler(req) {
    // CORS Handling
    if (req.method === 'OPTIONS') {
        return new Response(null, {
            status: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            },
        });
    }

    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    try {
        const body = await req.json();
        let token = req.headers.get('authorization'); // Default: Client provided token

        // OAuth2 Override (Priority)
        const clientId = process.env.PIPEFY_CLIENT_ID;
        const clientSecret = process.env.PIPEFY_CLIENT_SECRET;

        if (clientId && clientSecret) {
            try {
                // Exchange Client Credentials for Token
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
                    if (authData.access_token) {
                        token = `Bearer ${authData.access_token}`;
                    } else {
                        console.error('OAuth success but no access_token:', authData);
                    }
                } else {
                    console.error('OAuth Failed:', await authRes.text());
                }
            } catch (authError) {
                console.error('OAuth Request Error:', authError);
            }
        }

        if (!token) {
            return new Response(JSON.stringify({ error: 'Missing Authorization (No Token or OAuth configured)' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Forward to Pipefy GraphQL
        const pipefyRes = await fetch('https://api.pipefy.com/graphql', {
            method: 'POST',
            headers: {
                'Authorization': token,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        const data = await pipefyRes.json();

        return new Response(JSON.stringify(data), {
            status: pipefyRes.status,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
        });

    } catch (error) {
        return new Response(JSON.stringify({
            error: {
                message: error.message,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            }
        }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
        });
    }
}
