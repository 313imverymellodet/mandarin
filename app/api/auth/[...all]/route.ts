import { toNextJsHandler } from "better-auth/next-js"
import { NextResponse } from "next/server"
import { getAuth } from "@/lib/auth"

export const dynamic = "force-dynamic"

/** Better Auth endpoints (sign-in, OAuth callbacks, password reset links…). */
async function handle(request: Request): Promise<Response> {
  const auth = getAuth()
  if (!auth) return NextResponse.json({ error: "Authentication is not configured." }, { status: 503 })
  return auth.handler(request)
}

export const { GET, POST } = toNextJsHandler(handle)
