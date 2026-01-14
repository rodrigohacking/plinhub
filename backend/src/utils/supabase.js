const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase Service Client (Bypasses RLS)
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.warn("WARNING: Missing Supabase Environment Variables in Backend! (Supabase Client)");
}

const supabase = createClient(supabaseUrl, supabaseServiceKey || 'missing-key', {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

module.exports = supabase;
