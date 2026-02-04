require('dotenv').config({ path: '../.env' });
const { createClient } = require('@supabase/supabase-js');
const { encrypt } = require('../src/utils/encryption');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const NEW_TOKEN = 'EAAQ4U7H5GnABQkL7arVWJSfLhByNGFWk7EGZB9mwYSAFHZCCEjxIgcayzNiDGg1d2eZBmGhMeoZCN4xEDwaZAe8qNzsNSmS6b25tCFuPcwRR9ihUHAZBtSOoIkp0MyMKHNs4ZCgDWLxSOx1kM5GbZAiZCbuf86n1A2XVagwng5cZAxFB86jIxmDsrn5hMKFy40pgLI';

async function updateToken() {
    console.log("🔒 Encrypting token...");
    try {
        const encryptedToken = encrypt(NEW_TOKEN);
        console.log("✅ Token encrypted.");

        console.log("🔄 Updating database...");
        // Update ALL meta_ads integrations with this new token (assuming user wants this)
        const { data, error } = await supabase
            .from('Integration')
            .update({ metaAccessToken: encryptedToken, updatedAt: new Date() })
            .eq('type', 'meta_ads')
            .select();

        if (error) {
            console.error("❌ Error updating token:", error.message);
        } else {
            console.log(`✅ Successfully updated ${data.length} integrations.`);
            data.forEach(d => console.log(`   - Company ID: ${d.companyId}`));
        }
    } catch (e) {
        console.error("❌ Error:", e.message);
    }
}

updateToken();
