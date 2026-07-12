import { config } from "@/lib/config"
import type { TickerMarketDTO } from "./types"

/**
 * Kalshi public trade API. No auth required for reading open markets.
 * Prices are integer cents (1-99) representing implied probability.
 * Docs: https://trading-api.readme.io/reference/getmarkets
 */

interface KalshiMarket {
  ticker: string
  title: string
  yes_bid?: number
  yes_ask?: number
  last_price?: number
  volume?: number
  close_time?: string
  status?: string
}

function cents(n: number | undefined): string {
  if (typeof n !== "number") return "—"
  return `${Math.round(n)}¢`
}

function volume(n: number | undefined): string | undefined {
  if (typeof n !== "number" || n <= 0) return undefined
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}

export async function fetchKalshiTicker(limit = 10): Promise<TickerMarketDTO[]> {
  const url = new URL(`${config.kalshi.baseUrl}/markets`)
  url.searchParams.set("limit", String(Math.min(limit * 4, 100)))
  url.searchParams.set("status", "open")

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: Math.floor(config.cacheTtlMs / 1000) },
  })
  if (!res.ok) throw new Error(`Kalshi responded ${res.status}`)

  const data = (await res.json()) as { markets?: KalshiMarket[] }
  const markets = (data.markets ?? [])
    // Keep only priced, single-outcome markets. The default listing mixes in
    // multivariate "combo" markets with null prices and comma-joined titles.
    .filter((m) => {
      const price = m.last_price ?? m.yes_bid
      // Priced, live question (not effectively resolved), clean single title,
      // and still open.
      const priced = typeof price === "number" && price > 2 && price < 98
      const cleanTitle = typeof m.title === "string" && !m.title.includes(",") && m.title.length <= 80
      const open = !m.close_time || new Date(m.close_time).getTime() > Date.now()
      return priced && cleanTitle && open
    })
    .sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0))
    .slice(0, limit)

  return markets.map((m) => {
    const yes = m.last_price ?? m.yes_bid ?? 0
    return {
      id: `kalshi-${m.ticker}`,
      title: m.title,
      venue: "Kalshi",
      yes: cents(yes),
      no: cents(100 - yes),
      volume: volume(m.volume),
      eventTime: m.close_time,
    }
  })
}
