import { ScanSearch, GitCompareArrows, ShieldCheck } from "lucide-react"

const steps = [
  {
    icon: ScanSearch,
    title: "We scan every book",
    body: "Mandarin pulls live prices for the same game across US sportsbooks and prediction markets, refreshing continuously.",
  },
  {
    icon: GitCompareArrows,
    title: "We find the mispricing",
    body: "When two books disagree on the same outcome, backing each side at its best price can add up to less than 100%.",
  },
  {
    icon: ShieldCheck,
    title: "You lock the edge",
    body: "Stake both sides in the right proportion and the profit is the same no matter who wins — that gap is your edge.",
  },
]

export function HowItWorks() {
  return (
    <section aria-labelledby="how-it-works-heading" className="border-t border-border bg-muted/30">
      <div className="container mx-auto px-4 py-12 sm:py-16">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <h2 id="how-it-works-heading" className="text-balance text-2xl font-bold sm:text-3xl">
            How arbitrage works
          </h2>
          <p className="mt-2 text-pretty text-muted-foreground">
            A guaranteed edge isn&apos;t a hot take — it&apos;s two books disagreeing on the same game.
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

        <p className="mx-auto mt-8 max-w-2xl text-center text-xs text-muted-foreground">
          Real arbitrage is rare and fleeting, and odds move between refresh and placement. Always verify both lines on the
          venue before staking. Informational only, not financial advice.
        </p>
      </div>
    </section>
  )
}
