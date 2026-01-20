require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

async function setApolarGoals() {
    try {
        console.log('Setting Apolar goals...\n');

        // Get Apolar company ID
        const { data: company } = await supabase
            .from('Company')
            .select('id, name')
            .ilike('name', '%apolar%')
            .single();

        if (!company) {
            console.error('Apolar company not found');
            return;
        }

        console.log(`Company: ${company.name} (${company.id})\n`);

        // Current date
        const today = new Date().toISOString().split('T')[0];

        // Set goals as metrics
        const goal = {
            companyId: company.id,
            source: 'manual',
            label: 'all',
            date: today,
            spend: 3000, // Meta de investimento
            cpc: 50,     // Meta de CPL
            cardsCreated: 0,
            cardsConverted: 0
        };

        // Check if exists
        const { data: existing } = await supabase
            .from('Metric')
            .select('id')
            .eq('companyId', company.id)
            .eq('source', 'manual')
            .eq('label', 'all')
            .eq('date', today)
            .single();

        if (existing) {
            // Update
            const { error } = await supabase
                .from('Metric')
                .update({
                    spend: goal.spend,
                    cpc: goal.cpc
                })
                .eq('id', existing.id);

            if (error) {
                console.error('Error updating goal:', error);
            } else {
                console.log('✓ Updated goal');
            }
        } else {
            // Insert
            const { error } = await supabase
                .from('Metric')
                .insert(goal);

            if (error) {
                console.error('Error inserting goal:', error);
            } else {
                console.log('✓ Created goal');
            }
        }

        console.log('\n✅ Goals set successfully!');
        console.log('Meta de Investimento: R$ 3.000,00');
        console.log('Meta de CPL: R$ 50,00');
        console.log('\nRecarregue o dashboard para ver as metas atualizadas!');

    } catch (error) {
        console.error('Error:', error.message);
    }
}

setApolarGoals();
