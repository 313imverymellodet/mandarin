import { NextResponse } from "next/server"
import { getStripe } from "@/lib/stripe"
import { getCurrentUser, createClient } from "@/lib/supabase/server"
import { config } from "@/lib/config"

export const dynamic = "force-dynamic"

/** Opens the Stripe billing portal for the signed-in user's customer. */
export async function POST() {
  const stripe = getStripe()
  if (!stripe) return NextResponse.json({ error: "Payments are not configured." }, { status: 503 })

  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 })

  const supabase = await createClient()
  const { data } = supabase
    ? await supabase.from("subscriptions").select("stripe_customer_id").eq("user_id", user.id).maybeSingle()
    : { data: null }

  const customerId = data?.stripe_customer_id
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
