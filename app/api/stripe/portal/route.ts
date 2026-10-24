import { NextResponse } from "next/server"
import { getStripe } from "@/lib/stripe"
import { getCurrentUser } from "@/lib/session"
import { getSubscriptionForUser } from "@/lib/subscription"
import { config } from "@/lib/config"

export const dynamic = "force-dynamic"

/** Opens the Stripe billing portal for the signed-in user's customer. */
export async function POST() {
  const stripe = getStripe()
  if (!stripe) return NextResponse.json({ error: "Payments are not configured." }, { status: 503 })

  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 })

  const customerId = (await getSubscriptionForUser(user.id))?.stripe_customer_id
  if (!customerId) return NextResponse.json({ error: "No billing account found yet." }, { status: 404 })

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${config.site.url}/account`,
    })
    return NextResponse.json({ url: session.url })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not open billing portal." },
      { status: 500 },
    )
  }
}
