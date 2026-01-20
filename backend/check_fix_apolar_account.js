require('dotenv').config();
const supabase = require('./src/utils/supabase');

async function checkApolarAccountId() {
    try {
        console.log('Checking Apolar Ad Account ID in database...\n');

        const { data: apolar } = await supabase.from('Company')
            .select('*')
            .ilike('name', '%apolar%')
            .single();

        console.log('Company:', apolar.name);
        console.log('Company ID:', apolar.id);
        console.log('');

        const { data: integration } = await supabase.from('Integration')
            .select('*')
            .eq('companyId', apolar.id)
            .eq('type', 'meta_ads')
            .single();

        console.log('Current Integration:');
        console.log('  Integration ID:', integration.id);
        console.log('  Ad Account ID:', integration.metaAdAccountId);
        console.log('  Is Active:', integration.isActive);
        console.log('  Last Sync:', integration.lastSync);
        console.log('');

        const correctAccountId = '1060992149132250';

        if (integration.metaAdAccountId !== correctAccountId) {
            console.log('❌ INCORRECT Ad Account ID!');
            console.log('  Current:', integration.metaAdAccountId);
            console.log('  Should be:', correctAccountId);
            console.log('');
            console.log('Updating to correct Ad Account ID...');

            const { error } = await supabase
                .from('Integration')
                .update({
                    metaAdAccountId: correctAccountId,
                    lastSync: null // Reset sync to force re-sync
                })
                .eq('id', integration.id);

            if (error) {
                console.error('Error updating:', error);
            } else {
                console.log('✅ Updated successfully!');
                console.log('');
                console.log('Now you need to run sync again:');
                console.log('  node sync_apolar_all_campaigns.js');
            }
        } else {
            console.log('✅ Ad Account ID is correct:', correctAccountId);

            // Check what data is in the database
            const { data: metrics } = await supabase
                .from('Metric')
                .select('*')
                .eq('companyId', apolar.id)
                .eq('source', 'meta_ads')
                .order('date', { ascending: false })
                .limit(5);

            console.log('');
            console.log('Recent Meta Ads metrics:');
            metrics?.forEach(m => {
                console.log(`  ${m.date} - ${m.label}: R$ ${m.spend}, ${m.cardsCreated} leads`);
            });
        }

    } catch (error) {
        console.error('Error:', error.message);
    }
}

checkApolarAccountId();
