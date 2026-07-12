import { NextResponse } from "next/server"
import { getStripe, priceForPlan } from "@/lib/stripe"
import { getCurrentUser, createClient } from "@/lib/supabase/server"
import { config } from "@/lib/config"

export const dynamic = "force-dynamic"

/**
 * Creates a Stripe Checkout session for the signed-in user and returns its
 * URL. The client redirects the browser there.
 */
export async function POST(request: Request) {
  const stripe = getStripe()
  if (!stripe) return NextResponse.json({ error: "Payments are not configured." }, { status: 503 })

  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "You must be signed in to subscribe." }, { status: 401 })

  const { plan } = (await request.json().catch(() => ({}))) as { plan?: string }
  const priceId = priceForPlan(plan ?? "")
  if (!priceId) {
    return NextResponse.json({ error: `No Stripe price configured for plan "${plan}".` }, { status: 400 })
  }

  // Reuse an existing Stripe customer if we've already created one.
  const supabase = await createClient()
  let customerId: string | undefined
  if (supabase) {
    const { data } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle()
    customerId = data?.stripe_customer_id ?? undefined
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      customer: customerId,
      customer_email: customerId ? undefined : (user.email ?? undefined),
      client_reference_id: user.id,
      metadata: { user_id: user.id, plan: plan ?? "" },
      subscription_data: { metadata: { user_id: user.id } },
      allow_promotion_codes: true,
      success_url: `${config.site.url}/account?checkout=success`,
      cancel_url: `${config.site.url}/pricing?checkout=cancelled`,
    })
    return NextResponse.json({ url: session.url })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not start checkout." },
      { status: 500 },
    )
  }
}
