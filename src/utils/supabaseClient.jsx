// src/utils/supabaseClient.jsx
import { createClient } from '@supabase/supabase-js';

// These come from your .env file (see .env.example). In Vite, env vars
// exposed to the client must be prefixed with VITE_.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error(
        'Missing Supabase env vars. Make sure VITE_SUPABASE_URL and ' +
        'VITE_SUPABASE_ANON_KEY are set in your .env file.'
    );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);