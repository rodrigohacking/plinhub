import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Fallback to prevent crash if env vars are missing, allowing the UI to show a friendly error
const isValidUrl = (url) => {
    try { return Boolean(new URL(url)); } catch (e) { return false; }
};

const isConfigured = supabaseUrl && supabaseAnonKey && isValidUrl(supabaseUrl);

if (!isConfigured) {
    console.error('Supabase not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
}

export const supabase = isConfigured
    ? createClient(supabaseUrl, supabaseAnonKey)
    : {
        auth: {
            getSession: () => Promise.resolve({ data: { session: null }, error: new Error('Supabase not configured') }),
            onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => { } } } }),
            signInWithPassword: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') }),
            signOut: () => Promise.resolve({ error: null })
        }
    };