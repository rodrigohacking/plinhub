const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const { createClient } = require('@supabase/supabase-js');
const { encrypt } = require('../src/utils/encryption');

const NEW_TOKEN = "eyJhbGciOiJIUzUxMiJ9.eyJpc3MiOiJQaXBlZnkiLCJpYXQiOjE3NjU4OTA1OTcsImp0aSI6Ijg2YmFhNDVjLWMxNzgtNGQ3My04OWRiLTk1YWU4Mzc4ZmRiYiIsInN1YiI6MzA3MDYzNDY0LCJ1c2VyIjp7ImlkIjozMDcwNjM0NjQsImVtYWlsIjoicm9kcmlnby5sb3Blc0BncnVwb3BsaW4uY29tIn0sInVzZXJfdHlwZSI6ImF1dGhlbnRpY2F0ZWQifQ.Rb3iBb-KTvhNAVvHhsDsCobTdGEMMlizJVVCAwQBRH7IuEoW3T4oO44jBSLPBkp22TZSCnGItwyoMzHViEmAnA";

const COMPANIES = [
    { name: 'Andar Seguros', id: '4072d04e-4110-495e-aa13-16fd41402264' },
    { name: 'Apolar Condomínios', id: '5b936bf7-39ab-4f19-b636-818d6281dbd8' }
];

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function updateTokens() {
    console.log("Encrypting new token...");
    const encryptedToken = encrypt(NEW_TOKEN);

    for (const company of COMPANIES) {
        console.log(`Updating token for ${company.name} (${company.id})...`);

        // Check if integration exists
        const { data: existing, error: findError } = await supabase
            .from('Integration')
            .select('id')
            .eq('companyId', company.id)
            .eq('type', 'pipefy')
            .single();

        if (findError && findError.code !== 'PGRST116') {
            console.error(`Error finding integration for ${company.name}:`, findError.message);
            continue;
        }

        if (existing) {
            // Update
            const { error: updateError } = await supabase
                .from('Integration')
                .update({
                    pipefyToken: encryptedToken,
                    isActive: true, // Ensure it's re-activated
                    updatedAt: new Date()
                })
                .eq('id', existing.id);

            if (updateError) console.error(`Failed to update ${company.name}:`, updateError.message);
            else console.log(`✅ Updated ${company.name} successfully.`);
        } else {
            console.warn(`⚠️ No Pipefy integration found for ${company.name}. Skipping.`);
        }
    }
}

updateTokens();
