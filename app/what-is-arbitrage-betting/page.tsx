import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft, ArrowRight, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { MandarinLogo } from "@/components/mandarin-logo"
import { SiteFooter } from "@/components/site-footer"
import { pageMetadata } from "@/lib/seo"

export const metadata: Metadata = pageMetadata({
  title: "What is arbitrage betting?",
  description:
    "Arbitrage betting means covering every outcome of one event at different sportsbooks when their prices disagree enough to lock a profit if both bets are accepted. How the math works, and what can still go wrong.",
  path: "/what-is-arbitrage-betting",
})

export default function WhatIsArbitrageBettingPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container mx-auto flex items-center justify-between gap-3 px-4 py-4">
          <Link href="/" className="flex items-center gap-2">
            <MandarinLogo className="h-8 w-8" />
            <span className="text-xl font-semibold">Mandarin</span>
          </Link>
          <div className="flex items-center gap-1">
            <Link href="/how-it-works" className="hidden text-sm font-medium text-muted-foreground hover:text-foreground sm:inline">
              How it works
            </Link>
            <Link href="/">
              <Button variant="ghost" className="gap-2">
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Back to home
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-3xl px-4 py-12 sm:py-16">
        <div className="mb-12">
          <h1 className="text-balance text-3xl font-bold tracking-tight sm:text-5xl">What is arbitrage betting?</h1>
          <p className="mt-4 text-pretty text-lg leading-relaxed text-muted-foreground">
            Arbitrage betting — sometimes called arbing — is betting every result of the same event, at different
            sportsbooks, when their prices disagree enough that the combined payout is larger than the combined stake.
            If both bets are accepted at the prices you used, and then graded normally, the winner of the event does not
            change the profit.
          </p>
        </div>

        <section className="mb-12">
          <h2 className="mb-3 text-2xl font-bold">Why the gap exists</h2>
          <p className="text-muted-foreground leading-relaxed">
            Each sportsbook sets its own price. Those prices are not a single shared number, and they do not move at the
            same moment. A book also builds in a fee, the vig, so the implied chances of all outcomes usually add up to
            more than 100%. That is the house edge on one book. An arbitrage is the opposite situation across books: you
            take only the best price on each outcome, and those best prices add up to less than 100%.
          </p>
        </section>

        <section className="mb-12">
          <h2 className="mb-3 text-2xl font-bold">The arithmetic, in general</h2>
          <p className="mb-4 text-muted-foreground leading-relaxed">
            The check uses decimal odds. American prices convert like this: a positive price such as +150 is{" "}
            <span className="tabular-nums">1 + 150 / 100 = 2.50</span> in decimal. A negative price such as −110 is{" "}
            <span className="tabular-nums">1 + 100 / 110</span>, about 1.91. Implied probability is{" "}
            <span className="tabular-nums">1 ÷ decimal odds</span>.
          </p>
          <ol className="list-decimal space-y-3 pl-5 text-muted-foreground leading-relaxed">
            <li>List every result that can settle the market. On a two-way moneyline that is each side winning.</li>
            <li>For each result, keep the highest price any book is offering.</li>
            <li>Add the implied probabilities of those best prices.</li>
            <li>If the total is under 100%, the prices overround in the bettor&apos;s favor. That is an arbitrage.</li>
            <li>
              Split the stake in proportion to each result&apos;s implied probability, so every winning ticket returns the
              same amount.
            </li>
          </ol>
        </section>

        <section className="mb-12">
          <h2 className="mb-3 text-2xl font-bold">A hypothetical example</h2>
          <p className="mb-4 text-muted-foreground leading-relaxed">
            These prices are an illustration of the formula. They are not a line Mandarin recorded, and they are not a
            suggestion to bet.
          </p>
          <Card>
            <CardContent className="space-y-4 p-5 text-sm">
              <p>
                Book A offers one side at <strong>+150</strong> (decimal 2.50, implied 40%). Book B offers the other side
                of the same two-way market at <strong>+150</strong> (also 40%).
              </p>
              <p className="text-muted-foreground">
                40% + 40% = 80%, which is under 100%, so an arbitrage exists. The two prices match, so the stake splits
                evenly. On an $80 total, that is $40 each side.
              </p>
              <p className="text-muted-foreground">
                Whichever side wins, that $40 ticket pays <span className="tabular-nums">$40 × 2.50 = $100</span>. The
                $20 left after the $80 stake is a 25% return on stake — and only if both bets are taken at those prices
                and then settled as a normal win and a normal loss.
              </p>
              <p className="text-muted-foreground">
                For contrast, a single book at −110/−110 implies about 52.4% + 52.4% = 104.8%. That extra 4.8 points is
                vig. It is not an arbitrage.
              </p>
            </CardContent>
          </Card>
        </section>

        <section className="mb-12">
          <h2 className="mb-3 text-2xl font-bold">What it is not</h2>
          <ul className="space-y-3 text-muted-foreground leading-relaxed">
            <li>
              <strong className="text-foreground">Positive expected value.</strong> One side is priced better than an
              estimate of the fair chance. You bet that side only, and that bet can lose. The edge, if the estimate is
              right, shows up over many bets.
            </li>
            <li>
              <strong className="text-foreground">A hedge after the fact.</strong> Laying off a bet you already placed
              because the price moved is a different decision. It can lock a result on that position; it is not the same
              as finding both prices before you bet.
            </li>
            <li>
              <strong className="text-foreground">A promise that every screen price is bettable.</strong> The number on a
              site and the number the book will accept are not always the same.
            </li>
          </ul>
        </section>

        <section className="mb-12">
          <h2 className="mb-4 flex items-center gap-2 text-2xl font-bold">
            <AlertTriangle className="h-5 w-5 text-amber-500" aria-hidden="true" />
            Ways the &quot;lock&quot; fails
          </h2>
          <ul className="space-y-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-5 text-sm leading-relaxed text-muted-foreground">
            <li>The second price can move, or the book can reject the bet, after the first stake is already down. You then hold one side only.</li>
            <li>A book can void a wager it treats as an obvious error. One settled leg and one voided leg is not an arbitrage.</li>
            <li>Stake limits differ by book and account. The size that balances the position may not be available.</li>
            <li>Books sometimes limit or close accounts that consistently take their best number.</li>
            <li>
              A draw, a push, or another result you did not cover changes the math. A two-way split does not cover a
              three-way market.
            </li>
            <li>You need a funded balance at more than one book. Withdrawal timing is up to those books.</li>
            <li>Rules vary by location. This page is not legal advice, and it is not a recommendation to bet.</li>
          </ul>
        </section>

        <section className="mb-12">
          <h2 className="mb-3 text-2xl font-bold">Where Mandarin fits</h2>
          <p className="text-muted-foreground leading-relaxed">
            Mandarin compares prices across US sportsbooks and marks a two-sided arbitrage when the best prices on a
            market sum to less than 100%. It also shows one-sided positive-EV prices, which are not guaranteed. It never
            places a bet. Confirm both prices on the books before staking anything. The{" "}
            <Link href="/how-it-works" className="font-medium text-orange-600 hover:text-orange-700 dark:text-orange-400">
              how it works
            </Link>{" "}
            page walks through the de-vig and expected-value steps the scanner uses.
          </p>
        </section>

        <div className="flex flex-wrap gap-3">
          <Button asChild size="lg" className="gap-2 bg-orange-500 px-8 text-base text-white hover:bg-orange-600">
            <Link href="/how-it-works">
              How Mandarin finds an edge <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/sign-up">Create an account</Link>
          </Button>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
