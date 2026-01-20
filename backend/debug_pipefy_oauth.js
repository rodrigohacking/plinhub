
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const axios = require('axios');

async function testOAuthFlow() {
    console.log("--- Testing Pipefy OAuth2 Flow ---");

    const clientId = process.env.PIPEFY_CLIENT_ID;
    const clientSecret = process.env.PIPEFY_CLIENT_SECRET;

    console.log("Credentials:", {
        clientId: clientId ? `${clientId.substring(0, 5)}...` : 'MISSING',
        clientSecret: clientSecret ? `${clientSecret.substring(0, 5)}...` : 'MISSING'
    });

    if (!clientId || !clientSecret) {
        console.error("Missing credentials in .env");
        return;
    }

    try {
        console.log("Requesting Token...");
        const authRes = await axios.post('https://app.pipefy.com/oauth/token', {
            grant_type: 'client_credentials',
            client_id: clientId,
            client_secret: clientSecret
        });

        console.log("Status:", authRes.status);
        if (authRes.data.access_token) {
            console.log("SUCCESS! Access Token received.");
            console.log("Auth Response:", JSON.stringify(authRes.data, null, 2));
            console.log("Token:", `${authRes.data.access_token.substring(0, 10)}...`);

            // Test Validity with a real query
            await testQuery(authRes.data.access_token);
        } else {
            console.error("Failed to get token:", authRes.data);
        }

    } catch (e) {
        console.error("Auth Request Failed:", e.response?.data || e.message);
    }
}

async function testQuery(token) {
    console.log("\nTesting GraphQL Query with new token...");
    const query = `{ organizations { id name } }`;

    try {
        const res = await axios.post('https://api.pipefy.com/graphql', { query }, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            maxRedirects: 0,
            validateStatus: status => status < 500
        });

        console.log("Query Status:", res.status);
        console.log("Content-Type:", res.headers['content-type']);

        if (res.status >= 300 && res.status < 400) {
            console.error("Redirect Location:", res.headers.location);
        }

        if (res.data.errors) {
            console.error("Query Error:", res.data.errors[0].message);
        } else {
            const output = JSON.stringify(res.data, null, 2);
            console.log("Query Success! Data Sample:", output.substring(0, 500));
        }
    } catch (e) {
        console.log("Query Request Failed (Exception):");
        if (e.response) {
            console.log("Status:", e.response.status);
            console.log("Headers:", JSON.stringify(e.response.headers, null, 2));
            console.log("Data:", typeof e.response.data === 'string' ? e.response.data.substring(0, 100) : e.response.data);
        } else {
            console.log(e.message);
        }
    }
}

testOAuthFlow();
