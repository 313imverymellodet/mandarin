import { createClient } from "@supabase/supabase-js"
import { config } from "@/lib/config"

/**
 * Service-role Supabase client. Bypasses RLS — use ONLY in trusted
 * server-side contexts (e.g. the Stripe webhook) and never expose the
 * service role key to the browser. Returns null when unconfigured.
 */
export function createAdminClient() {
  if (!config.supabase.url || !config.supabase.serviceRoleKey) return null
  return createClient(config.supabase.url, config.supabase.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
