"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight, X, Zap, ShieldCheck, MousePointerClick, HelpCircle } from "lucide-react"

const STORAGE_KEY = "mandarin.onboarding.dismissed.v1"

const points = [
  {
    icon: Zap,
    title: "Most rows are +EV, not free money",
    body: "A green +EV badge means a book is paying more than the true odds. Profitable over many bets — you can still lose any single one.",
  },
  {
    icon: ShieldCheck,
    title: "ARB means guaranteed — and rare",
    body: "Back both sides, profit either way. Most days there are zero. That's the market being efficient, not the app being broken.",
  },
  {
    icon: MousePointerClick,
    title: "Click any row for the details",
    body: "You'll get the exact book and price, the fair odds we compared against, a suggested stake, and one-click links to open the books.",
  },
]

/**
 * First-run orientation for the scanner. The board is dense and jargon-heavy;
 * this gives a new user the mental model before they meet it. Dismissed state
 * persists locally, and the header keeps a permanent link to the full guide.
 */
export function OnboardingPanel() {
  // Start hidden so the server render and first paint agree; reveal after we
  // can read localStorage.
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      if (window.localStorage.getItem(STORAGE_KEY) !== "true") setVisible(true)
    } catch {
      setVisible(true) // storage blocked — still worth showing once per load
    }
  }, [])

  const dismiss = () => {
    setVisible(false)
    try {
      window.localStorage.setItem(STORAGE_KEY, "true")
    } catch {
      // Non-fatal: it just shows again next visit.
    }
  }

  if (!visible) return null

  return (
    <section
      aria-labelledby="onboarding-heading"
      className="relative rounded-xl border border-orange-500/30 bg-orange-500/5 p-4 sm:p-5"
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss getting started"
        className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground transition-colors hover:bg-orange-500/10 hover:text-foreground"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>

      <h2 id="onboarding-heading" className="pr-8 text-sm font-semibold">
        New here? 30-second orientation
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        This board is dense on purpose. Here&apos;s how to read it.
      </p>

      <ol className="mt-4 grid gap-3 sm:grid-cols-3">
        {points.map((p) => (
          <li key={p.title} className="rounded-lg border border-border bg-card p-3">
            <div className="mb-1.5 flex items-center gap-2">
              <p.icon className="h-4 w-4 flex-shrink-0 text-orange-500" aria-hidden="true" />
              <h3 className="text-xs font-semibold">{p.title}</h3>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">{p.body}</p>
          </li>
        ))}
      </ol>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={dismiss} className="bg-orange-500 text-white hover:bg-orange-600">
          Got it
        </Button>
        <Button asChild size="sm" variant="outline" className="gap-1.5 bg-transparent">
          <Link href="/how-it-works">
            <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
            How it works
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </section>
  )
}
