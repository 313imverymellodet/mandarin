import { NextResponse, type NextRequest } from "next/server"
import { createServerClient, type CookieOptions } from "@supabase/ssr"
import { config } from "@/lib/config"

/** Routes that require an authenticated session. */
const PROTECTED_PREFIXES = ["/arbitrage", "/account"]

/**
 * Refreshes the Supabase auth session on every request and redirects
 * unauthenticated users away from protected routes. When Supabase isn't
 * configured this is a no-op so the app still runs.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  if (!config.supabase.enabled) return response

  const supabase = createServerClient(config.supabase.url!, config.supabase.anonKey!, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })

  // IMPORTANT: getUser() must be called to refresh the token; do not remove.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))

  if (!user && isProtected) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = "/sign-in"
    redirectUrl.searchParams.set("redirectTo", pathname)
    return NextResponse.redirect(redirectUrl)
  }

  return response
}
