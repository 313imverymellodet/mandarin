import type { Metadata } from "next"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { MandarinLogo } from "@/components/mandarin-logo"
import { ArrowLeft, ArrowRight, ScanSearch, Scissors, Target, ShieldCheck, Zap, AlertTriangle } from "lucide-react"

export const metadata: Metadata = {
  title: "How Mandarin works — finding a real betting edge",
  description:
    "How Mandarin strips the vig off a sharp line to find the true odds, then flags books paying more than they should. Arbitrage vs positive EV, explained plainly.",
}

const glossary: { term: string; definition: string }[] = [
  {
    term: "Vig (juice)",
    definition:
      "The book's built-in fee. It's why a coin-flip game is priced -110/-110 instead of +100/+100 — the odds add up to more than 100%, and the extra is the house's cut.",
  },
  {
    term: "De-vig",
    definition:
      "Stripping that fee back out of a book's prices to reveal what it really thinks the odds are. -110/-110 de-vigs to a clean 50%/50%.",
  },
  {
    term: "Fair probability",
    definition:
      "The de-vigged, true chance of an outcome — our best estimate of reality. Everything else is measured against this number.",
  },
  {
    term: "Fair value (anchor)",
    definition:
      "Whose line we trust to define fair probability. We prefer Pinnacle — the book sharp bettors use, which prices most accurately. If it isn't available we blend at least 3 books into a consensus.",
  },
  {
    term: "EV% (expected value)",
    definition:
      "How much you'd expect to make per dollar, on average, over many identical bets. +5% EV means $100 staked is worth ~$105 in the long run — not on any single bet.",
  },
  {
    term: "Edge / gap to arbitrage",
    definition:
      "For arbitrage rows: how much guaranteed profit is locked in. A negative number is the gap — how far the market still is from a true arb.",
  },
  {
    term: "Confidence (0–100)",
    definition:
      "A data-quality score, NOT the chance your bet wins. It rises with more books quoting, tighter agreement between them, a true sharp anchor, and sensible timing.",
  },
  {
    term: "¼ Kelly",
    definition:
      "A staking guide. Full Kelly is the mathematically growth-optimal bet size; it's also brutally swingy, so we show a quarter of it as a percentage of your bankroll.",
  },
  {
    term: "Move 1h",
    definition:
      "How the edge has shifted in the last hour. Green means it's moving toward a live arbitrage; the sparkline shows the recent path.",
  },
  {
    term: "Verify flag",
    definition:
      "An edge too large to be believable is almost always a stale or unbettable line. We still show it, flagged red, so you confirm it on the book before trusting it.",
  },
]

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <Link href="/" className="flex items-center gap-2">
            <MandarinLogo className="h-8 w-8" />
            <span className="text-xl font-semibold">Mandarin</span>
          </Link>
          <Link href="/">
            <Button variant="ghost" className="gap-2">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to home
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto max-w-3xl px-4 py-12 sm:py-16">
        {/* Hero */}
        <div className="mb-14 text-center">
          <h1 className="text-balance text-3xl font-bold tracking-tight sm:text-5xl">How Mandarin finds an edge</h1>
          <p className="mx-auto mt-4 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground">
            Sportsbooks aren&apos;t oracles — they&apos;re businesses with a fee baked into every price. Mandarin does one
            thing: work out what the <em>real</em> odds are, then find books paying more than they should.
          </p>
        </div>

        {/* The core idea */}
        <section className="mb-14">
          <h2 className="mb-2 text-2xl font-bold">The one idea behind all of it</h2>
          <p className="mb-6 text-muted-foreground">
            Every price you see has the book&apos;s fee — the <strong className="text-foreground">vig</strong> — baked in.
            Strip it out of the sharpest book&apos;s line and you get the true odds. Then it&apos;s just comparison.
          </p>

          <ol className="space-y-3">
            {[
              {
                icon: ScanSearch,
                title: "Read the sharpest line",
                body: "Pinnacle is the book professionals bet into. It takes sharp money and moves fast, which makes its prices the closest thing to the real odds.",
              },
              {
                icon: Scissors,
                title: "Cut out the vig",
                body: "We remove the fee from that line to get the fair probability — what the outcome is actually worth, with no house cut.",
              },
              {
                icon: Target,
                title: "Find who's paying too much",
                body: "We compare every book you can bet at against that fair probability. Anyone paying more than the true odds is handing you an edge.",
              },
            ].map((step, i) => (
              <li key={step.title} className="flex gap-4 rounded-xl border border-border bg-card p-4">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-orange-500/10">
                  <step.icon className="h-4.5 w-4.5 text-orange-500" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="font-semibold">
                    <span className="mr-1.5 tabular-nums text-muted-foreground">{i + 1}.</span>
                    {step.title}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Worked example */}
        <section className="mb-14">
          <h2 className="mb-2 text-2xl font-bold">A real example</h2>
          <p className="mb-4 text-muted-foreground">This is exactly the math the app runs, on every game, every minute.</p>

          <Card className="overflow-hidden">
            <CardContent className="space-y-4 p-5 text-sm">
              <div>
                <p className="font-medium">1. Pinnacle prices a fight −110 / −110.</p>
                <p className="mt-1 text-muted-foreground">
                  Those odds imply 52.4% + 52.4% = <span className="tabular-nums">104.8%</span>. It can&apos;t be 104.8% —
                  that extra 4.8% is the vig.
                </p>
              </div>
              <div className="border-t border-border pt-4">
                <p className="font-medium">2. Strip the vig → the true odds are 50% / 50%.</p>
                <p className="mt-1 text-muted-foreground">A genuine coin flip. That&apos;s our fair probability.</p>
              </div>
              <div className="border-t border-border pt-4">
                <p className="font-medium">3. DraftKings is paying +110 on one fighter.</p>
                <p className="mt-1 text-muted-foreground">
                  +110 returns <span className="tabular-nums">$2.10</span> per $1. But the true chance is 50%.
                </p>
              </div>
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
                <p className="flex items-center gap-1.5 font-semibold text-emerald-600 dark:text-emerald-400">
                  <Zap className="h-4 w-4" aria-hidden="true" /> 50% × $2.10 = $1.05 → +5% EV
                </p>
                <p className="mt-1.5 text-muted-foreground">
                  For every $100 you put on that bet you&apos;d expect ~$105 back <strong>on average, over many bets</strong>.
                  This single fight is still a coin flip — you can absolutely lose it. The edge only shows up over volume.
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Two signals */}
        <section className="mb-14">
          <h2 className="mb-2 text-2xl font-bold">The two things Mandarin shows you</h2>
          <p className="mb-5 text-muted-foreground">
            They are <strong className="text-foreground">not</strong> the same, and the difference matters a lot.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="border-green-500/30">
              <CardContent className="p-5">
                <div className="mb-2 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-green-600 dark:text-green-400" aria-hidden="true" />
                  <h3 className="font-semibold">Arbitrage</h3>
                  <span className="rounded bg-green-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-green-600 dark:text-green-400">
                    ARB
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Two books disagree so badly you can back <strong className="text-foreground">both sides</strong> and profit
                  no matter who wins. Genuinely guaranteed — and genuinely rare. Most days the board shows zero, and that&apos;s
                  the tool being honest, not broken.
                </p>
              </CardContent>
            </Card>

            <Card className="border-emerald-500/30">
              <CardContent className="p-5">
                <div className="mb-2 flex items-center gap-2">
                  <Zap className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                  <h3 className="font-semibold">Positive EV</h3>
                  <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                    +EV
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  One book is paying more than the true odds. You bet{" "}
                  <strong className="text-foreground">one side</strong> and can lose it. But make these repeatedly and the
                  math works in your favour. This is the engine — it&apos;s what you&apos;ll see most days.
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="mt-4 overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2 font-medium" />
                  <th className="px-4 py-2 font-medium">Arbitrage</th>
                  <th className="px-4 py-2 font-medium">Positive EV</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["How often", "Rare — often none", "Several most days"],
                  ["You bet", "Both sides", "One side"],
                  ["This bet", "Profit guaranteed", "Can lose"],
                  ["Long run", "Profit locked now", "Profits over volume"],
                  ["Main risk", "A line moves before you place leg 2", "Variance — you need many bets"],
                ].map(([label, arb, ev]) => (
                  <tr key={label} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5 font-medium text-muted-foreground">{label}</td>
                    <td className="px-4 py-2.5">{arb}</td>
                    <td className="px-4 py-2.5">{ev}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Glossary */}
        <section className="mb-14">
          <h2 className="mb-2 text-2xl font-bold">Every word on the board</h2>
          <p className="mb-5 text-muted-foreground">The scanner is dense on purpose. Here&apos;s what each term means.</p>
          <dl className="divide-y divide-border rounded-lg border border-border">
            {glossary.map(({ term, definition }) => (
              <div key={term} className="grid gap-1 p-4 sm:grid-cols-3 sm:gap-4">
                <dt className="font-semibold">{term}</dt>
                <dd className="text-sm leading-relaxed text-muted-foreground sm:col-span-2">{definition}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Honest caveats */}
        <section className="mb-14">
          <h2 className="mb-4 flex items-center gap-2 text-2xl font-bold">
            <AlertTriangle className="h-5 w-5 text-amber-500" aria-hidden="true" />
            What this can&apos;t do
          </h2>
          <ul className="space-y-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-5 text-sm leading-relaxed">
            {[
              "+EV is a long-run average. You will lose plenty of individual bets — that's the math working normally, not the tool failing.",
              "Odds move. A price can change between our refresh and your click, which kills the edge. Always confirm on the book before you stake.",
              "Confidence is a data-quality score, not the chance your bet wins. A 90/100 bet can lose.",
              "Books limit or close accounts that consistently beat them. That's their business, and it's a real cost of this strategy.",
              "Mandarin never places a bet for you, and nothing here is financial advice. Betting may be restricted where you live — that's on you to check.",
            ].map((item) => (
              <li key={item} className="flex gap-2">
                <span className="mt-2 h-1 w-1 flex-shrink-0 rounded-full bg-amber-500" aria-hidden="true" />
                <span className="text-muted-foreground">{item}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* CTA */}
        <div className="text-center">
          <Button asChild size="lg" className="gap-2 bg-orange-500 px-8 text-base text-white hover:bg-orange-600">
            <Link href="/arbitrage">
              Open the scanner <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </main>
    </div>
  )
}
