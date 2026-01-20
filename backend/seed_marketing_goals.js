const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'backend/.env' });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing credentials");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const COMPANY_ID = '4072d04e-4110-495e-aa13-16fd41402264'; // Andar Seguros
const CURRENT_SOURCE = 'target_manual'; // Distinguish these as targets, not raw syncs
// Using a consistent date for "Current Month Goal"
const GOAL_DATE = new Date().toISOString().slice(0, 10); // Today

const DEFAULTS = [
    { label: 'condominial', spend: 2500, cpc: 30 },
    { label: 'rc_sindico', spend: 1500, cpc: 25 },
    { label: 'automovel', spend: 1000, cpc: 10 },
    { label: 'residencial', spend: 500, cpc: 10 }
];

async function seedGoals() {
    console.log(`🌱 Seeding Marketing Goals for Company ${COMPANY_ID}...`);

    for (const def of DEFAULTS) {
        // Upsert Logic: Check if exists for this month/label
        // Ideally we match by year-month but 'date' is exact day.
        // We act like 'Storage.js' -> "Target" is the latest row with this label.
        // So inserting a NEW row is safer/cleaner for history, or updating if one exists today.

        const payload = {
            companyId: COMPANY_ID,
            source: CURRENT_SOURCE,
            date: GOAL_DATE,
            label: def.label,
            spend: def.spend,
            cpc: def.cpc // Mapped to CPL Target
        };

        const { data, error } = await supabase
            .from('Metric')
            .upsert(payload, { onConflict: 'companyId, source, date, label', ignoreDuplicates: false })
            // Note: Upsert needs a unique constraint to actually UPDATE, otherwise it Inserts.
            // If specific unique constraint missing, it likely inserts. That's fine.
            .select();

        if (error) {
            console.error(`❌ Failed to seed ${def.label}:`, error.message);
        } else {
            console.log(`✅ Seeded ${def.label}: Invest R$${def.spend}, CPL R$${def.cpc}`);
        }
    }
}

seedGoals();
