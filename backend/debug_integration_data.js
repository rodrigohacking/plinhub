const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const supabase = require('./src/utils/supabase');

async function checkIntegrations() {
    console.log("🔌 Checking Integrations for Apolar UUID...");

    // Andar Seguros UUID
    const COMPANY_ID = '4072d04e-4110-495e-aa13-16fd41402264';

    const { data: integrations, error } = await supabase
        .from('Integration')
        .select('*')
        .eq('companyId', COMPANY_ID);

    if (error) {
        console.error("❌ Error fetching integrations:", error.message);
        return;
    }

    if (!integrations || integrations.length === 0) {
        console.log("⚠️ No integrations found for this UUID.");
    } else {
        console.log(`✅ Found ${integrations.length} integrations:`);
        integrations.forEach(i => {
            console.log(`   - Type: ${i.type} | Active: ${i.isActive} | PipeID: ${i.pipefyPipeId} | Token Length: ${i.pipefyToken ? i.pipefyToken.length : 0}`);
        });
    }
}

checkIntegrations();
