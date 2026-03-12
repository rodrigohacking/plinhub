const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase Service Client (Bypasses RLS)
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("FATAL: Missing Supabase Environment Variables (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY). Server cannot start.");
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

module.exports = supabase;
