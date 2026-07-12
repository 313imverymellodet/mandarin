import { createClient } from "@/lib/supabase/server"

export interface Subscription {
  plan: string | null
  status: string
  current_period_end: string | null
  cancel_at_period_end: boolean
  stripe_customer_id: string | null
}

const ACTIVE_STATUSES = new Set(["active", "trialing"])

/** Fetch the current user's subscription row (RLS restricts to the owner). */
export async function getSubscription(): Promise<Subscription | null> {
  const supabase = await createClient()
  if (!supabase) return null

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from("subscriptions")
    .select("plan, status, current_period_end, cancel_at_period_end, stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle()

  return (data as Subscription) ?? null
}

export function isSubscriptionActive(sub: Subscription | null): boolean {
  return Boolean(sub && ACTIVE_STATUSES.has(sub.status))
}
