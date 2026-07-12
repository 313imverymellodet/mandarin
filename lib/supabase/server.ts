import { cookies } from "next/headers"
import { createServerClient, type CookieOptions } from "@supabase/ssr"
import { config } from "@/lib/config"

/**
 * Server-side Supabase client bound to the request's cookies. Used in
 * Server Components, Route Handlers and Server Actions. Returns null when
 * Supabase isn't configured so callers can degrade gracefully.
 */
export async function createClient() {
  if (!config.supabase.enabled) return null

  const cookieStore = await cookies()

  return createServerClient(config.supabase.url!, config.supabase.anonKey!, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // Called from a Server Component where cookies are read-only.
          // Session refresh is handled by middleware, so this is safe to ignore.
        }
      },
    },
  })
}

/** Returns the currently authenticated user, or null. */
export async function getCurrentUser() {
  const supabase = await createClient()
  if (!supabase) return null
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}
