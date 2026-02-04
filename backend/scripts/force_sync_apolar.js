const axios = require('axios');
const COMPANY_ID = '5b936bf7-39ab-4f19-b636-818d6281dbd8'; // Apolar ID
const URL = `http://localhost:3001/api/sync/${COMPANY_ID}/force`;

async function forceSync() {
    console.log(`Forcing sync for ${COMPANY_ID} (Apolar)...`);
    try {
        const res = await axios.post(URL);
        console.log("Sync Status:", res.status);
        console.log("Response:", res.data);
    } catch (e) {
        console.error("Sync Failed:", e.message);
        if (e.response) console.error(e.response.data);
    }
}

forceSync();
