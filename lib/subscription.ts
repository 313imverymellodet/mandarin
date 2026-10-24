import { getPool } from "@/lib/db"
import { getCurrentUser } from "@/lib/session"

export interface Subscription {
  plan: string | null
  status: string
  current_period_end: string | null
  cancel_at_period_end: boolean
  stripe_customer_id: string | null
}

const ACTIVE_STATUSES = new Set(["active", "trialing"])

/** Fetch the signed-in user's subscription row. */
export async function getSubscription(): Promise<Subscription | null> {
  const user = await getCurrentUser()
  if (!user) return null
  return getSubscriptionForUser(user.id)
}

export async function getSubscriptionForUser(userId: string): Promise<Subscription | null> {
  const pool = getPool()
  if (!pool) return null
  try {
    const { rows } = await pool.query<Subscription>(
      `select plan, status, current_period_end, cancel_at_period_end, stripe_customer_id
         from subscriptions where user_id = $1 limit 1`,
      [userId],
    )
    return rows[0] ?? null
  } catch (error) {
    console.error("subscription lookup failed:", error instanceof Error ? error.message : error)
    return null
  }
}

export function isSubscriptionActive(sub: Subscription | null): boolean {
  return Boolean(sub && ACTIVE_STATUSES.has(sub.status))
}
