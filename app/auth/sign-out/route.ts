import { NextResponse } from "next/server"
import { getAuth } from "@/lib/auth"

export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL("/", request.url), { status: 303 })
  const auth = getAuth()
  if (!auth) return response

  try {
    // Revoke the session server-side and forward Better Auth's cookie-clearing headers.
    const result = await auth.api.signOut({ headers: request.headers, asResponse: true })
    for (const cookie of result.headers.getSetCookie()) response.headers.append("set-cookie", cookie)
  } catch {
    // Already signed out — just redirect.
  }
  return response
}
