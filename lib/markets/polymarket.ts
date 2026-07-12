import { config } from "@/lib/config"
import type { TickerMarketDTO } from "./types"

/**
 * Polymarket Gamma API. Public, no auth for reading markets.
 * `outcomes` and `outcomePrices` come back as JSON-encoded strings.
 * Docs: https://docs.polymarket.com/#gamma-markets-api
 */

interface PolymarketMarket {
  id: string
  question: string
  slug?: string
  outcomes?: string // JSON string, e.g. '["Yes","No"]'
  outcomePrices?: string // JSON string, e.g. '["0.62","0.38"]'
  volume?: string | number
  endDate?: string
  closed?: boolean
}

function parseJsonArray(value: string | undefined): string[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    return []
  }
}

function pct(price: string | undefined): string {
  const n = Number(price)
  if (!Number.isFinite(n)) return "—"
  return `${Math.round(n * 100)}¢`
}

function volume(value: string | number | undefined): string | undefined {
  const n = typeof value === "string" ? Number(value) : value
  if (!Number.isFinite(n) || !n || n <= 0) return undefined
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return String(Math.round(n))
}

export async function fetchPolymarketTicker(limit = 10): Promise<TickerMarketDTO[]> {
  const url = new URL(`${config.polymarket.baseUrl}/markets`)
  url.searchParams.set("closed", "false")
  url.searchParams.set("active", "true")
  // Over-fetch: the quality gates below discard a large share of rows.
  url.searchParams.set("limit", String(limit * 5))
  url.searchParams.set("order", "volume")
  url.searchParams.set("ascending", "false")

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: Math.floor(config.cacheTtlMs / 1000) },
  })
  if (!res.ok) throw new Error(`Polymarket responded ${res.status}`)

  const data = (await res.json()) as PolymarketMarket[]
  if (!Array.isArray(data)) return []

  const markets: TickerMarketDTO[] = []
  const now = Date.now()
  for (const m of data) {
    if (markets.length >= limit) break
    const prices = parseJsonArray(m.outcomePrices)
    if (prices.length < 2) continue

    // Quality gates: skip effectively-resolved markets (≤2¢ / ≥98¢ they're
    // noise, not a live question), expired markets, and dead volume.
    const yesPct = Number(prices[0]) * 100
    if (!Number.isFinite(yesPct) || yesPct <= 2 || yesPct >= 98) continue
    if (m.endDate && new Date(m.endDate).getTime() <= now) continue
    const vol = typeof m.volume === "string" ? Number(m.volume) : (m.volume ?? 0)
    if (!Number.isFinite(vol) || vol < 1000) continue

    markets.push({
      id: `polymarket-${m.id}`,
      title: m.question,
      venue: "Polymarket",
      yes: pct(prices[0]),
      no: pct(prices[1]),
      volume: volume(m.volume),
      eventTime: m.endDate,
    })
  }
  return markets
}
