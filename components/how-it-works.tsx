import Link from "next/link"
import { ArrowRight, Scissors, Zap, ShieldCheck } from "lucide-react"

const steps = [
  {
    icon: Scissors,
    title: "We find the true odds",
    body: "Every price has the book's fee baked in. We take the sharpest line on the board — Pinnacle, the book pros bet into — and strip that fee out to reveal what the game is really worth.",
  },
  {
    icon: Zap,
    title: "We spot who's overpaying",
    body: "Then we check every book you can actually bet at. Anyone paying more than the true odds is a positive-EV bet — profitable over many bets, though any single one can lose.",
  },
  {
    icon: ShieldCheck,
    title: "And we catch the rare locks",
    body: "Occasionally two books disagree so badly you can back both sides and profit either way. That's arbitrage — guaranteed, but rare. When it appears, it jumps to the top.",
  },
]

export function HowItWorks() {
  return (
    <section aria-labelledby="how-it-works-heading" className="border-t border-border bg-muted/30">
      <div className="container mx-auto px-4 py-12 sm:py-16">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <h2 id="how-it-works-heading" className="text-balance text-2xl font-bold sm:text-3xl">
            How Mandarin finds an edge
          </h2>
          <p className="mt-2 text-pretty text-muted-foreground">
            Sportsbooks aren&apos;t oracles — they&apos;re businesses with a fee in every price. Find the real odds, and the
            mistakes show up.
          </p>
        </div>

        <ol className="grid gap-6 sm:grid-cols-3">
          {steps.map((step, i) => (
            <li key={step.title} className="relative rounded-xl border border-border bg-card p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/10">
                  <step.icon className="h-5 w-5 text-orange-500" aria-hidden="true" />
                </div>
                <span className="text-sm font-semibold tabular-nums text-muted-foreground">Step {i + 1}</span>
              </div>
              <h3 className="mb-1.5 font-semibold">{step.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{step.body}</p>
            </li>
          ))}
        </ol>

        <div className="mt-8 text-center">
          <Link
            href="/how-it-works"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300"
          >
            See the full breakdown — with a worked example and every term explained
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <p className="mx-auto mt-6 max-w-2xl text-xs text-muted-foreground">
            Positive EV pays off over many bets, not any single one — you will lose some. Arbitrage is rare and fleeting, and
            odds move between refresh and placement. Always verify on the venue before staking. Informational only, not
            financial advice.
          </p>
        </div>
      </div>
    </section>
  )
}
