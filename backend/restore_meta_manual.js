const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const supabase = require('./src/utils/supabase');

async function runRestoreMeta() {
    console.log("🔄 Running Restore for Meta Ads...");

    const updates = [
        {
            // Andar Seguros
            companyId: '4072d04e-4110-495e-aa13-16fd41402264',
            type: 'meta_ads',
            metaAdAccountId: '631649546531729',
            metaAccessToken: 'EAAQ4U7H5GnABQRgqTYN5ttGPQISuMZAxyXmO0axdOZCJotGBsZAhoT8mOVTKe1Q1D60boBMSgXZAYsLY8ysZCBz8WN4ZC3uEmYSnZAMrjdLP0URn3MXdPTiPfB3DJeuNEq9nJnBs1lLgLlOLsfzJ8SxQ5kwnbbWMylesZAZBx2sz9T8PlzHCow8CLwfLWxUS4',
            isActive: true,
            updatedAt: new Date()
        },
        {
            // Apolar Condomínios
            companyId: '5b936bf7-39ab-4f19-b636-818d6281dbd8',
            type: 'meta_ads',
            metaAdAccountId: '1060992149132250',
            metaAccessToken: 'EAAQ4U7H5GnABQRgqTYN5ttGPQISuMZAxyXmO0axdOZCJotGBsZAhoT8mOVTKe1Q1D60boBMSgXZAYsLY8ysZCBz8WN4ZC3uEmYSnZAMrjdLP0URn3MXdPTiPfB3DJeuNEq9nJnBs1lLgLlOLsfzJ8SxQ5kwnbbWMylesZAZBx2sz9T8PlzHCow8CLwfLWxUS4',
            isActive: true,
            updatedAt: new Date()
        }
    ];

    const { data, error } = await supabase
        .from('Integration')
        .upsert(updates, { onConflict: 'companyId, type' })
        .select();

    if (error) {
        console.error("❌ Error running meta restore:", error);
    } else {
        console.log("✅ Meta Ads Restore successful!", data.length, "integrations updated.");
        data.forEach(d => console.log(`   - Company: ${d.companyId} | Account: ${d.metaAdAccountId}`));
    }
}

runRestoreMeta();
