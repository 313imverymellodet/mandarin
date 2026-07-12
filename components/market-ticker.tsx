"use client"

import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { CountdownTimer } from "@/components/countdown-timer"
import type { TickerMarketDTO, TickerResponse } from "@/lib/markets/types"

const REFRESH_MS = 30_000

export function MarketTicker() {
  const [markets, setMarkets] = useState<TickerMarketDTO[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    const load = async () => {
      try {
        const res = await fetch("/api/markets/ticker", { signal: controller.signal, cache: "no-store" })
        if (!res.ok) throw new Error(String(res.status))
        const data = (await res.json()) as TickerResponse
        setMarkets(data.markets ?? [])
      } catch {
        // Leave markets empty; the placeholder below communicates state.
      } finally {
        setLoaded(true)
      }
    }
    load()
    const interval = setInterval(load, REFRESH_MS)
    return () => {
      controller.abort()
      clearInterval(interval)
    }
  }, [])

  // Reserve height before first load to avoid layout shift.
  if (!loaded && markets.length === 0) {
    return <div className="h-16 border-b border-border bg-background sm:h-[84px]" aria-hidden="true" />
  }

  if (markets.length === 0) {
    return (
      <div className="border-b border-border bg-background px-4 py-3 text-center text-xs text-muted-foreground">
        Live prediction-market prices appear here once Kalshi/Polymarket are reachable.
      </div>
    )
  }

  return (
    <section className="overflow-hidden border-b border-border bg-background" aria-label="Live market ticker">
      <div className="border-b border-orange-500/15 bg-orange-500/5 px-4 py-1.5 text-center text-[11px] font-medium uppercase tracking-widest text-orange-600 dark:text-orange-400">
        Live prices · Kalshi &amp; Polymarket
      </div>
      <div className="flex animate-scroll hover:[animation-play-state:paused]">
        {[...markets, ...markets].map((market, index) => (
          <article
            key={`${market.id}-${index}`}
            className="min-w-36 flex-shrink-0 border-r border-border px-4 py-2.5 transition-colors hover:bg-orange-500/5 sm:min-w-44 sm:px-6 sm:py-4"
          >
            <div className="mb-1.5 flex items-center justify-between gap-2 sm:mb-2">
              <Badge variant="outline" className="text-[10px] font-medium sm:text-xs">
                {market.venue}
              </Badge>
              {market.eventTime && <CountdownTimer eventTime={new Date(market.eventTime)} compact />}
            </div>
            <div className="mb-1 line-clamp-1 max-w-40 text-sm font-medium" title={market.title}>
              {market.title}
            </div>
            <div className="flex gap-3 text-xs">
              <span>
                Yes <span className="font-semibold text-orange-500">{market.yes}</span>
              </span>
              <span>
                No <span className="font-semibold text-muted-foreground">{market.no}</span>
              </span>
            </div>
            {market.volume && <span className="mt-1 hidden text-xs text-muted-foreground sm:block">Vol: {market.volume}</span>}
          </article>
        ))}
      </div>
    </section>
  )
}
