import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/**
 * Exchanges the `code` from an email-confirmation or OAuth redirect for a
 * session, then forwards the user on. Supabase sets the session cookies via
 * the server client's cookie adapter.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const next = searchParams.get("next") ?? "/arbitrage"

  if (code) {
    const supabase = await createClient()
    if (supabase) {
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      if (!error) return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/sign-in?error=Could not sign you in. Please try again.`)
}
