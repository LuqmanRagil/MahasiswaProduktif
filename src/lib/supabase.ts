import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const env = import.meta.env;
const url = (env.VITE_SUPABASE_URL as string | undefined)?.trim();
// Supabase sekarang memakai "publishable key" (sb_publishable_...). Key lama "anon" juga masih bisa dipakai.
const key = ((env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) || (env.VITE_SUPABASE_ANON_KEY as string | undefined))?.trim();

/** true jika Supabase sudah dikonfigurasi di .env.local */
export const isSupabaseConfigured = Boolean(url && key);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, key!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" },
    })
  : null;
