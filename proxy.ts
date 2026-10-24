import { NextResponse, type NextRequest } from "next/server"
import { getSessionCookie } from "better-auth/cookies"

/** Routes that require a signed-in user. */
const PROTECTED_PREFIXES = ["/arbitrage", "/account"]

/**
 * Optimistic gate: redirect to sign-in when there's no session cookie at all.
 * This only checks the cookie exists (no DB hit at the edge) — pages and API
 * routes still verify the session server-side with getCurrentUser().
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (!PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))) return NextResponse.next()
  // Auth not configured: leave the app open rather than locking everyone out.
  if (!process.env.DATABASE_URL || !process.env.BETTER_AUTH_SECRET) return NextResponse.next()

  if (!getSessionCookie(request)) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = "/sign-in"
    redirectUrl.search = ""
    redirectUrl.searchParams.set("redirectTo", pathname)
    return NextResponse.redirect(redirectUrl)
  }
  return NextResponse.next()
}

export const config = {
  matcher: ["/arbitrage/:path*", "/account/:path*"],
}
