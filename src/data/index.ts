import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { createLocalStore } from "./localStore";
import type { DataStore } from "./store";
import { createSupabaseStore } from "./supabaseStore";

/** Satu-satunya pintu ke data aplikasi. */
export const store: DataStore = isSupabaseConfigured && supabase ? createSupabaseStore(supabase) : createLocalStore();
export const isLocalMode = store.kind === "local";
export * from "./store";
