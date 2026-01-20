const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'backend/.env' }); // Load backend env

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing credentials");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMetric() {
    // Check columns first via empty select
    const { data, error } = await supabase.from('Metric').select('*').limit(1);

    if (error) {
        console.error("Error:", error);
    } else {
        console.log("Metric Table Sample:", data);
        if (data.length > 0) {
            console.log("Keys:", Object.keys(data[0]));
        } else {
            console.log("Metric table is empty.");
        }
    }
}

checkMetric();
