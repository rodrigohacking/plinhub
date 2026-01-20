const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const PROXY_URL = 'http://localhost:3001/api/pipefy';

async function testPersistentToken() {
    try {
        console.log("Testing Proxy using Persistent Backend Token (No Header)...");
        const query = `{ organizations { id name } }`;

        // Emulate Request WITHOUT Header (Should use backend env token)
        const res = await axios.post(PROXY_URL, { query });

        if (res.data.data) {
            console.log("Persistent Token Success! Response:", res.data.data.organizations[0]);
        } else {
            console.error("Proxy returned data but partial/error:", res.data);
        }

    } catch (e) {
        console.error("Proxy Failed:", e.message);
        if (e.response) {
            console.error("Status:", e.response.status);
            console.error("Data:", e.response.data);
        }
    }
}

testPersistentToken();
