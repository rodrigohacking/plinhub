require('dotenv').config({ path: __dirname + '/../.env' });
const supabase = require('../src/utils/supabase');

async function updateAndar() {
    console.log("🔄 Updating Andar Seguros Credentials...");
    const companyId = '4072d04e-4110-495e-aa13-16fd41402264';

    // User Provided Credentials
    const newToken = 'EAAQ4U7H5GnABQl8vywVQIdHGqu5YnUvrDYaTHe0ZBbI06zZAjEesZBwXObPgP9iAJ0I2pKeZCIHWO3Ef6GavyjvLtfc9OxdOrts8a1LSJGozk3vWIWZB8Bbo9ZAO7bFymhCOkJlyEECRyRmbxDtW2mHIJ1tH7uqWMouyP8jGQaJAh62hXHkXTyFdbPHDWN';
    const newAccountId = '631649546531729';

    try {
        const { data, error } = await supabase
            .from('Company')
            .update({
                meta_access_token: newToken,
                meta_ad_account_id: newAccountId
            })
            .eq('id', companyId)
            .select();

        if (error) {
            console.error("❌ Link Error:", error);
            return;
        }

        console.log("✅ Credentials Updated Successfully:");
        console.log(data);

    } catch (e) {
        console.error(e);
    }
}

updateAndar();
