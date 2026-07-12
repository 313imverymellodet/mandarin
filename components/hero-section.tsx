"use client"

import Link from "next/link"
import { ArrowRight, CheckCircle2, Radio, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"

export function HeroSection() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1 text-sm font-medium text-orange-600 dark:text-orange-400">
            <Radio className="h-3.5 w-3.5" />
            Live market data
          </div>
        </div>

        <h1 className="text-balance text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
          Compare prediction market prices with clarity.
        </h1>
        <p className="max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground sm:text-xl">
          Mandarin surfaces real price differences, guaranteed edges, and timing across US sportsbooks and prediction markets — updated live.
        </p>
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-3 text-sm text-muted-foreground">
        {["Live sportsbook odds", "Guaranteed edges", "Risk-aware analysis"].map((item) => (
          <div key={item} className="flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-orange-500" />
            <span>{item}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <Button asChild size="lg" className="gap-2 bg-orange-500 px-8 text-base text-white shadow-lg shadow-orange-500/20 hover:bg-orange-600">
          <Link href="/arbitrage">
            View live opportunities <Sparkles className="h-5 w-5" />
          </Link>
        </Button>
        <Button asChild size="lg" variant="outline" className="gap-2 bg-transparent px-8 text-base hover:border-orange-500/50 hover:bg-orange-500/10">
          <Link href="/demo">
            How it works <ArrowRight className="h-5 w-5" />
          </Link>
        </Button>
      </div>

      <div className="flex flex-col gap-3 border-t border-border pt-6">
        <p className="text-sm font-medium">Data you can act on — but always verify before you stake.</p>
        <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
          Odds are aggregated from third-party providers and can change between refresh and placement. Mandarin does not
          place bets on your behalf. Informational only, not financial advice.
        </p>
      </div>
    </div>
  )
}
