import { NextResponse } from "next/server"
import type Stripe from "stripe"
import { getStripe, planForPrice } from "@/lib/stripe"
import { getPool } from "@/lib/db"
import { config } from "@/lib/config"

export const dynamic = "force-dynamic"

/**
 * Stripe webhook. Verifies the signature, then mirrors subscription state
 * into Postgres (server-side, never exposed to the client). This is
 * the source of truth for who has an active plan.
 */
export async function POST(request: Request) {
  const stripe = getStripe()
  if (!stripe || !config.stripe.webhookSecret) {
    return NextResponse.json({ error: "Stripe webhook not configured." }, { status: 503 })
  }

  const signature = request.headers.get("stripe-signature")
  if (!signature) return NextResponse.json({ error: "Missing signature." }, { status: 400 })

  const body = await request.text()
  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, config.stripe.webhookSecret)
  } catch (error) {
    return NextResponse.json(
      { error: `Signature verification failed: ${error instanceof Error ? error.message : "unknown"}` },
      { status: 400 },
    )
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.subscription) {
          const sub = await stripe.subscriptions.retrieve(session.subscription as string)
          await syncSubscription(stripe, sub, session.metadata?.user_id ?? session.client_reference_id)
        }
        break
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription
        await syncSubscription(stripe, sub)
        break
      }
      default:
        break
    }
  } catch (error) {
    // Return 500 so Stripe retries; log for observability.
    console.error("Stripe webhook handler error:", error)
    return NextResponse.json({ error: "Handler failed." }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

async function syncSubscription(
  stripe: Stripe,
  subscription: Stripe.Subscription,
  fallbackUserId?: string | null,
) {
  const pool = getPool()
  if (!pool) {
    // Throw so the webhook returns 500 and Stripe retries once the DB is back.
    throw new Error("Cannot sync subscription: DATABASE_URL not set.")
  }

  const userId = subscription.metadata?.user_id ?? fallbackUserId
  const item = subscription.items.data[0]
  const priceId = item?.price?.id ?? null
  // period end is per-item in recent API versions, top-level in older ones.
  const periodEndUnix =
    (item as unknown as { current_period_end?: number })?.current_period_end ??
    (subscription as unknown as { current_period_end?: number }).current_period_end

  const row = {
    stripe_customer_id: subscription.customer as string,
    stripe_subscription_id: subscription.id,
    price_id: priceId,
    plan: planForPrice(priceId),
    status: subscription.status,
    current_period_end: periodEndUnix ? new Date(periodEndUnix * 1000).toISOString() : null,
    cancel_at_period_end: subscription.cancel_at_period_end,
  }

  // Prefer keying by user_id (unique). If we don't have it (e.g. a raw
  // subscription.updated without metadata), fall back to the customer id.
  const values = [
    row.stripe_customer_id,
    row.stripe_subscription_id,
    row.price_id,
    row.plan,
    row.status,
    row.current_period_end,
    row.cancel_at_period_end,
  ]
  if (userId) {
    await pool.query(
      `insert into subscriptions
         (user_id, stripe_customer_id, stripe_subscription_id, price_id, plan, status, current_period_end, cancel_at_period_end, updated_at)
       values ($8, $1, $2, $3, $4, $5, $6, $7, now())
       on conflict (user_id) do update set
         stripe_customer_id = excluded.stripe_customer_id,
         stripe_subscription_id = excluded.stripe_subscription_id,
         price_id = excluded.price_id,
         plan = excluded.plan,
         status = excluded.status,
         current_period_end = excluded.current_period_end,
         cancel_at_period_end = excluded.cancel_at_period_end,
         updated_at = now()`,
      [...values, userId],
    )
  } else {
    await pool.query(
      `update subscriptions set
         stripe_customer_id = $1, stripe_subscription_id = $2, price_id = $3, plan = $4,
         status = $5, current_period_end = $6, cancel_at_period_end = $7, updated_at = now()
       where stripe_customer_id = $1`,
      values,
    )
  }
}
