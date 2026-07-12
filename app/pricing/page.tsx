"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MandarinLogo } from "@/components/mandarin-logo"
import { paymentsEnabled } from "@/lib/payments"
import { Check, ArrowLeft, Zap, Crown, Rocket } from "lucide-react"

const plans = [
  {
    name: "Free",
    planId: null,
    icon: Zap,
    price: "$0",
    period: "forever",
    description: "Perfect for getting started",
    features: [
      "5 arbitrage alerts per day",
      "NFL & NBA markets only",
      "Delayed odds",
      "Basic profit calculator",
      "Email support",
    ],
    cta: "Get Started",
    popular: false,
  },
  {
    name: "Pro",
    planId: "pro",
    icon: Crown,
    price: "$29",
    period: "per month",
    description: "For serious arbitrage traders",
    features: [
      "Unlimited arbitrage alerts",
      "All sports & prediction markets",
      "Real-time odds updates",
      "Advanced profit calculator",
      "Sound & push notifications",
      "Quick-action platform links",
      "Risk indicators",
      "Priority support",
    ],
    cta: "Upgrade to Pro",
    popular: true,
  },
  {
    name: "Team",
    planId: "team",
    icon: Rocket,
    price: "$99",
    period: "per month",
    description: "For professional trading teams",
    features: [
      "Everything in Pro",
      "API access",
      "Custom integrations",
      "Dedicated account manager",
      "Team collaboration tools",
      "Historical data export",
      "White-label options",
      "24/7 phone support",
    ],
    cta: "Upgrade to Team",
    popular: false,
  },
]

export default function PricingPage() {
  const router = useRouter()
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">("monthly")
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSelect = async (planId: string | null) => {
    setError(null)
    // Open-beta mode: no billing configured — everyone just signs up free.
    if (!paymentsEnabled || !planId) {
      router.push("/sign-up")
      return
    }
    setLoadingPlan(planId)
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planId }),
      })
      if (res.status === 401) {
        router.push(`/sign-in?redirectTo=/pricing`)
        return
      }
      const data = await res.json()
      if (!res.ok || !data.url) throw new Error(data.error ?? "Couldn't start checkout.")
      window.location.href = data.url
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.")
      setLoadingPlan(null)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <MandarinLogo className="w-8 h-8" />
            <span className="font-semibold text-xl">Mandarin</span>
          </Link>
          <Link href="/">
            <Button variant="ghost" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to home
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-16">
        {/* Hero */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-orange-500/10 rounded-full border border-orange-500/20 mb-4">
            <Zap className="h-3.5 w-3.5 text-orange-500" />
            <span className="text-orange-600 dark:text-orange-400 text-sm font-medium">
              {paymentsEnabled ? "Simple pricing" : "Free open beta"}
            </span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold mb-4 text-balance">
            {paymentsEnabled ? (
              <>
                Choose the plan that fits your{" "}
                <span className="bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent">
                  trading style
                </span>
              </>
            ) : (
              <>
                Everything&apos;s{" "}
                <span className="bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent">
                  free
                </span>{" "}
                while we&apos;re in beta
              </>
            )}
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {paymentsEnabled
              ? "Start free and upgrade as you grow. All plans include our core arbitrage detection technology."
              : "Every feature below is unlocked for testers — no card, no charge. Just sign up and start finding edges."}
          </p>
        </div>

        {/* Billing toggle */}
        <div className={`flex items-center justify-center gap-4 mb-12 ${paymentsEnabled ? "" : "hidden"}`}>
          <span className={billingPeriod === "monthly" ? "text-foreground" : "text-muted-foreground"}>Monthly</span>
          <button
            onClick={() => setBillingPeriod(billingPeriod === "monthly" ? "yearly" : "monthly")}
            className={`relative w-14 h-7 rounded-full transition-colors ${
              billingPeriod === "yearly" ? "bg-orange-500" : "bg-muted"
            }`}
          >
            <span
              className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform ${
                billingPeriod === "yearly" ? "translate-x-7" : "translate-x-1"
              }`}
            />
          </button>
          <span className={billingPeriod === "yearly" ? "text-foreground" : "text-muted-foreground"}>
            Yearly <span className="text-orange-500 text-sm font-medium">Save 20%</span>
          </span>
        </div>

        {error && (
          <div
            role="alert"
            className="mx-auto mb-8 max-w-md rounded-md border border-red-500/30 bg-red-500/10 p-3 text-center text-sm text-red-600 dark:text-red-400"
          >
            {error}
          </div>
        )}

        {/* Pricing cards */}
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan) => {
            const Icon = plan.icon
            const price =
              billingPeriod === "yearly" && plan.price !== "$0"
                ? `$${Math.round(Number.parseInt(plan.price.slice(1)) * 0.8)}`
                : plan.price

            return (
              <Card
                key={plan.name}
                className={`relative ${
                  plan.popular ? "border-orange-500 shadow-lg shadow-orange-500/10 scale-105" : "border-border"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-orange-500 text-white text-xs font-medium rounded-full">
                    Most Popular
                  </div>
                )}
                <CardHeader>
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`p-2 rounded-lg ${plan.popular ? "bg-orange-500/10" : "bg-muted"}`}>
                      <Icon className={`h-5 w-5 ${plan.popular ? "text-orange-500" : "text-muted-foreground"}`} />
                    </div>
                    <CardTitle>{plan.name}</CardTitle>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold">{price}</span>
                    <span className="text-muted-foreground">/{plan.period}</span>
                  </div>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <ul className="space-y-3">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <Check className="h-5 w-5 text-orange-500 shrink-0 mt-0.5" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    onClick={() => handleSelect(plan.planId)}
                    disabled={loadingPlan === plan.planId}
                    className={`w-full ${
                      plan.popular
                        ? "bg-orange-500 hover:bg-orange-600 text-white"
                        : "bg-secondary hover:bg-secondary/80"
                    }`}
                  >
                    {loadingPlan === plan.planId ? "Redirecting…" : paymentsEnabled ? plan.cta : "Get started free"}
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* FAQ section */}
        <div className="mt-24 max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">Frequently Asked Questions</h2>
          <div className="space-y-6">
            {[
              {
                q: "What is arbitrage betting?",
                a: "Arbitrage betting exploits price differences between bookmakers to guarantee a profit regardless of the outcome. When Platform A offers different odds than Platform B for the same event, you can bet on both sides and lock in a profit.",
              },
              {
                q: "How fresh are your odds?",
                a: "Paid plans get live odds refreshed continuously from our data providers. Odds can still move between refresh and placement, so always confirm on the venue.",
              },
              {
                q: "Can I cancel anytime?",
                a: "Yes. Plans are month-to-month with no long-term contracts, and you can cancel anytime from Manage Billing on your account page.",
              },
              {
                q: "Which platforms do you support?",
                a: "US sportsbooks via The Odds API (DraftKings, FanDuel, BetMGM, Caesars, BetRivers and more), plus prediction markets Kalshi and Polymarket.",
              },
            ].map((faq) => (
              <div key={faq.q} className="border-b border-border pb-6">
                <h3 className="font-medium mb-2">{faq.q}</h3>
                <p className="text-muted-foreground text-sm">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
