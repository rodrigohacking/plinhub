require('dotenv').config({ path: __dirname + '/../.env' });
const supabase = require('../src/utils/supabase');
const { encrypt } = require('../src/utils/encryption');

async function updateMetaToken() {
    const newToken = 'EAAQ4U7H5GnABQl8vywVQIdHGqu5YnUvrDYaTHe0ZBbI06zZAjEesZBwXObPgP9iAJ0I2pKeZCIHWO3Ef6GavyjvLtfc9OxdOrts8a1LSJGozk3vWIWZB8Bbo9ZAO7bFymhCOkJlyEECRyRmbxDtW2mHIJ1tH7uqWMouyP8jGQaJAh62hXHkXTyFdbPHDWN';
    const companyId = '5b936bf7-39ab-4f19-b636-818d6281dbd8'; // Apolar ID

    console.log(`🔐 Updating Meta Ads Token for Apolar (${companyId})...`);

    try {
        const encryptedToken = encrypt(newToken);

        const { data, error } = await supabase
            .from('Integration')
            .update({
                metaAccessToken: encryptedToken,
                updatedAt: new Date()
            })
            .eq('companyId', companyId)
            .eq('type', 'meta_ads')
            .select();

        if (error) {
            console.error('❌ Error updating token:', error);
            return;
        }

        console.log('✅ Token updated successfully!');
        if (data && data.length > 0) {
            console.log('   Updated Record ID:', data[0].id);
        } else {
            console.warn('   ⚠️ No records updated. Check if integration exists.');
        }

    } catch (e) {
        console.error('❌ Exception:', e);
    }
}

updateMetaToken();
