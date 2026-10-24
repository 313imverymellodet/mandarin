import { headers } from "next/headers"
import { getAuth } from "@/lib/auth"

export interface CurrentUser {
  id: string
  email: string
  name: string | null
}

/** Returns the signed-in user for this request, or null. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const auth = getAuth()
  if (!auth) return null
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session) return null
    return { id: session.user.id, email: session.user.email, name: session.user.name || null }
  } catch (error) {
    console.error("session lookup failed:", error instanceof Error ? error.message : error)
    return null
  }
}
