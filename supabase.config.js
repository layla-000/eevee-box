const EEVEE_SUPABASE_URL = "https://yhliabpgjnraozzfpxgy.supabase.co";
const EEVEE_SUPABASE_KEY = "sb_publishable_kNDndAby5yjCpplSbzAGZA_hAF9K3Fl";

window.EeveeSupabase = supabase.createClient(
  EEVEE_SUPABASE_URL,
  EEVEE_SUPABASE_KEY,
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
);
