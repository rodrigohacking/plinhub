const axios = require('axios');

async function listCompanies() {
    console.log("Listing Companies...");
    // We can't hit /api/companies directly without auth usually, but let's try or use Supabase directly.
    // Using Supabase directly is safer for admin scripts.

    const { createClient } = require('@supabase/supabase-js');
    const path = require('path');
    require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
    require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

    const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    const { data: companies, error } = await supabase
        .from('Company')
        .select('id, name');

    if (error) {
        console.error("Error:", error);
    } else {
        console.table(companies);
    }
}

listCompanies();
