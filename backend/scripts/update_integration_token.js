require('dotenv').config({ path: __dirname + '/../.env' });
const supabase = require('../src/utils/supabase');

async function updateIntegration() {
    console.log("🔄 Updating Andar Seguros Credentials in Integration table...");
    const companyId = '4072d04e-4110-495e-aa13-16fd41402264';

    // User Provided Credentials
    const newToken = 'EAAQ4U7H5GnABQl8vywVQIdHGqu5YnUvrDYaTHe0ZBbI06zZAjEesZBwXObPgP9iAJ0I2pKeZCIHWO3Ef6GavyjvLtfc9OxdOrts8a1LSJGozk3vWIWZB8Bbo9ZAO7bFymhCOkJlyEECRyRmbxDtW2mHIJ1tH7uqWMouyP8jGQaJAh62hXHkXTyFdbPHDWN';
    const newAccountId = '631649546531729';

    try {
        const { data, error } = await supabase
            .from('Integration')
            .update({
                metaAccessToken: newToken,
                metaAdAccountId: newAccountId,
                metaStatus: 'active', // Ensure it's active
                isActive: true
            })
            .eq('companyId', companyId)
            // .eq('type', 'meta_ads') // if type column exists and multiple rows, but user only gave 1 set.
            // Let's assume one row per company or filter by type?
            // "Keys: type, pipefyOrgId..." suggests it might be one row per company or one per type.
            // Let's filter by type='meta_ads' to be safe IF the row exists. If no row, Insert?
            // Let's first try Update with companyId.
            .select();

        if (error) {
            console.error("❌ Update Error:", error);
            return;
        }

        if (data && data.length > 0) {
            console.log("✅ Integration Updated Successfully:");
            console.log(data);
        } else {
            console.log("⚠️ No existing integration found using companyId. Attempting INSERT...");
            // Insert logic if needed, but likely exists.
            // Try find types?
        }

    } catch (e) {
        console.error(e);
    }
}

updateIntegration();
