// Shared Supabase client for the whole site.
// Publishable key is safe to expose in frontend code by design (Supabase's
// row-level security controls what it can actually do) — never put the
// secret/service key here.
const SUPABASE_URL = 'https://vwrsekxffahnkqwuzoda.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_-315sBEtz4ZpNvaabJXbsQ_cpAmTOOI';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
