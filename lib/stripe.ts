import Stripe from "stripe"
import { config } from "@/lib/config"

/**
 * Lazily-constructed Stripe client. Returns null when STRIPE_SECRET_KEY is
 * absent so payment routes can respond with a clear error instead of
 * crashing at import time.
 */
let cached: Stripe | null = null

export function getStripe(): Stripe | null {
  if (!config.stripe.enabled) return null
  if (!cached) {
    cached = new Stripe(config.stripe.secretKey!, {
      appInfo: { name: "Mandarin", version: "0.1.0" },
      typescript: true,
    })
  }
  return cached
}

/** Map a public plan id to its configured Stripe Price id. */
export function priceForPlan(plan: string): string | undefined {
  if (plan === "pro") return config.stripe.prices.pro
  if (plan === "team") return config.stripe.prices.team
  return undefined
}

/** Reverse map: Stripe Price id back to a plan label for storage. */
export function planForPrice(priceId: string | null | undefined): string | null {
  if (!priceId) return null
  if (priceId === config.stripe.prices.pro) return "pro"
  if (priceId === config.stripe.prices.team) return "team"
  return null
}
