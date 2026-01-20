require('dotenv').config({ path: 'backend/.env' });
const { createClient } = require('@supabase/supabase-js');
const { encrypt } = require('./src/utils/encryption');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const COMPANY_ID = '4072d04e-4110-495e-aa13-16fd41402264';
const META_ACT_ID = 'act_631649546531729';
const META_TOKEN = 'EAAQ4U7H5GnABQVNZCGgss6m6akseQFQ1vfYS5tgIia7Cgi7mEV42g364FzJidpwnxcy00S73Td4YTuwmCZA5YNdv2TH8cyHtb6eY7qioIUZCsbrNRM7fEWHkXGTRSOGNnzWT0HK9uGPiicZA1KaEBIZCUykrWrSB02BVFYzblLFzZAvx4Gzp0kFLOSbpqt';

async function updateCredentials() {
    console.log(`🔐 Updating credentials for company ${COMPANY_ID}...`);

    // Check if integration exists
    const { data: existing } = await supabase
        .from('Integration')
        .select('*')
        .eq('companyId', COMPANY_ID)
        .eq('type', 'meta_ads')
        .single();

    const encryptedToken = encrypt(META_TOKEN);

    const payload = {
        companyId: COMPANY_ID,
        type: 'meta_ads',
        metaAdAccountId: META_ACT_ID,
        metaAccessToken: encryptedToken,
        isActive: true,
        updatedAt: new Date()
    };

    if (existing) {
        // Update
        const { error } = await supabase
            .from('Integration')
            .update(payload)
            .eq('id', existing.id);

        if (error) {
            console.error("Error updating:", error);
        } else {
            console.log("✅ Credentials updated successfully (Encrypted).");
        }
    } else {
        // Insert
        const { error } = await supabase
            .from('Integration')
            .insert(payload);

        if (error) {
            console.error("Error inserting:", error);
        } else {
            console.log("✅ New Integration record created.");
        }
    }
}

updateCredentials();
