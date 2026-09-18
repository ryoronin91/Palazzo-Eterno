const SUPABASE_URL = "https://bhqinurfersdgrxbgfrf.supabase.co";

const SUPABASE_KEY = "sb_publishable_9h0J-1bqT9FoT0dB6ylLcw_pm_I0346";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

console.log("Palazzo Eterno - Supabase collegato!");
console.log(supabaseClient);