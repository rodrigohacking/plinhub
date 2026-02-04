const axios = require('axios');
const COMPANY_ID = '4072d04e-4110-495e-aa13-16fd41402264'; // Andar Seguros
const URL = `http://localhost:3001/api/sync/${COMPANY_ID}/force`;

async function forceSync() {
    console.log(`Forcing sync for ${COMPANY_ID}...`);
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
