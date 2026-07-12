import { createBrowserClient } from "@supabase/ssr"
import { config } from "@/lib/config"

/**
 * Browser Supabase client. Throws only if called while unconfigured — UI
 * that uses it should first check `config.supabase.enabled`.
 */
export function createClient() {
  if (!config.supabase.enabled) {
    throw new Error("Supabase is not configured (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY).")
  }
  return createBrowserClient(config.supabase.url!, config.supabase.anonKey!)
}
