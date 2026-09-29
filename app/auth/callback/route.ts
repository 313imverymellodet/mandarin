import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { safeRedirectPath } from "@/lib/safe-redirect"

/**
 * Exchanges the `code` from an email-confirmation or OAuth redirect for a
 * session, then forwards the user on. Supabase sets the session cookies via
 * the server client's cookie adapter.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  // `next` is attacker-controllable; "@evil.com" appended to the origin would
  // redirect off-site, so only same-origin paths are honored.
  const next = safeRedirectPath(searchParams.get("next"))

  if (code) {
    const supabase = await createClient()
    if (supabase) {
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      if (!error) return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/sign-in?error=Could not sign you in. Please try again.`)
}
