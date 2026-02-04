
const { createClient } = require('@supabase/supabase-js');
const { encrypt } = require('../src/utils/encryption');

// Load environment variables directly from process.env since we pass them inline
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("❌ Missing Supabase credentials in environment variables.");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// TOKEN PROVIDED BY USER
const NEW_TOKEN = 'EAAQ4U7H5GnABQkL7arVWJSfLhByNGFWk7EGZB9mwYSAFHZCCEjxIgcayzNiDGg1d2eZBmGhMeoZCN4xEDwaZAe8qNzsNSmS6b25tCFuPcwRR9ihUHAZBtSOoIkp0MyMKHNs4ZCgDWLxSOx1kM5GbZAiZCbuf86n1A2XVagwng5cZAxFB86jIxmDsrn5hMKFy40pgLI';

async function updateToken() {
    console.log("🔒 Encrypting token...");
    try {
        const encryptedToken = encrypt(NEW_TOKEN);
        if (!encryptedToken) {
            throw new Error("Encryption failed (returned null/undefined)");
        }
        console.log("✅ Token encrypted length:", encryptedToken.length);

        console.log("🔄 Updating database...");

        // Explicitly update records found in the previous step
        const { data, error } = await supabase
            .from('Integration')
            .update({ metaAccessToken: encryptedToken, updatedAt: new Date() })
            .eq('type', 'meta_ads')
            .select();

        if (error) {
            console.error("❌ Error updating token:", error.message);
        } else {
            console.log(`✅ Successfully updated ${data.length} integrations.`);
            data.forEach(d => console.log(`   - Company ID: ${d.companyId} updated.`));
        }
    } catch (e) {
        console.error("❌ Error:", e.message);
    }
}

updateToken();
