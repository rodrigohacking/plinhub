// Test script to check Supabase connection and Relation Structure
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
    console.log("Testing connection to Supabase...");
    console.log("URL:", supabaseUrl);

    // Test Relation Fetch
    console.log("Fetching Company with Integration...");
    const { data: companies, error: err1 } = await supabase
        .from('Company')
        .select('*, Integration(*)');

    if (err1) {
        console.error("Error fetching Company with Integration:", err1);
    } else {
        console.log("Success! Found", companies.length, "companies.");
        if (companies.length > 0) {
            console.log("First Company Structure Key Check:");
            const c = companies[0];
            console.log("Keys:", Object.keys(c));

            if (c.Integration) console.log("Has 'Integration' key (Correct)");
            if (c.integrations) console.log("Has 'integrations' key (Wrong)");
            if (!c.Integration && !c.integrations) console.log("MISSING RELATION KEY!");

            console.log("First Company Data:", JSON.stringify(c, null, 2));
        }
    }
}

testConnection();
