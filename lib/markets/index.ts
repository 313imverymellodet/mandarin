import { config } from "@/lib/config"
import { fetchOddsApiOpportunities } from "./odds-api"
import { fetchKalshiTicker } from "./kalshi"
import { fetchPolymarketTicker } from "./polymarket"
import type {
  OpportunitiesResponse,
  OpportunityDTO,
  SourceStatus,
  TickerMarketDTO,
  TickerResponse,
} from "./types"

/**
 * Aggregation + in-process cache. A short TTL cache in front of the upstream
 * APIs is essential: the Odds API free tier allows only a few hundred
 * requests per month, so we never want per-visitor fan-out.
 */

interface CacheEntry<T> {
  value: T
  expires: number
}

const cache = new Map<string, CacheEntry<unknown>>()

async function cached<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
  const hit = cache.get(key) as CacheEntry<T> | undefined
  if (hit && hit.expires > Date.now()) return hit.value
  const value = await loader()
  cache.set(key, { value, expires: Date.now() + ttlMs })
  return value
}

export async function getOpportunities(): Promise<OpportunitiesResponse> {
  return cached("opportunities", config.cacheTtlMs, async () => {
    const sources: SourceStatus[] = []
    let opportunities: OpportunityDTO[] = []

    if (config.oddsApi.enabled) {
      try {
        opportunities = await fetchOddsApiOpportunities()
        sources.push({ id: "odds-api", label: "Sportsbooks (The Odds API)", enabled: true, ok: true })
      } catch (error) {
        sources.push({
          id: "odds-api",
          label: "Sportsbooks (The Odds API)",
          enabled: true,
          ok: false,
          message: messageOf(error),
        })
      }
    } else {
      sources.push({
        id: "odds-api",
        label: "Sportsbooks (The Odds API)",
        enabled: false,
        ok: false,
        message: "ODDS_API_KEY not configured",
      })
    }

    // Arbs first (best edge on top), then watch rows closest to crossing
    // into arbitrage. Cap watch rows so the payload stays lean.
    opportunities.sort((a, b) => b.arbitrage - a.arbitrage)
    const arbs = opportunities.filter((o) => o.kind === "arbitrage")
    const watch = opportunities.filter((o) => o.kind === "watch").slice(0, 24)
    opportunities = [...arbs, ...watch]

    const enabledSources = sources.filter((s) => s.enabled)
    const degraded = enabledSources.length > 0 && enabledSources.every((s) => !s.ok)

    return {
      opportunities,
      sources,
      degraded,
      generatedAt: new Date().toISOString(),
    }
  })
}

export async function getTicker(): Promise<TickerResponse> {
  return cached("ticker", config.cacheTtlMs, async () => {
    const tasks: Promise<TickerMarketDTO[]>[] = []
    if (config.kalshi.enabled) tasks.push(safe(fetchKalshiTicker(6)))
    if (config.polymarket.enabled) tasks.push(safe(fetchPolymarketTicker(6)))

    const results = await Promise.all(tasks)
    const markets = interleave(results).slice(0, 12)
    return { markets, generatedAt: new Date().toISOString() }
  })
}

/** Round-robin merge so the ticker alternates venues instead of clumping. */
function interleave(lists: TickerMarketDTO[][]): TickerMarketDTO[] {
  const out: TickerMarketDTO[] = []
  const max = Math.max(0, ...lists.map((l) => l.length))
  for (let i = 0; i < max; i++) {
    for (const list of lists) {
      if (list[i]) out.push(list[i])
    }
  }
  return out
}

async function safe<T>(promise: Promise<T[]>): Promise<T[]> {
  try {
    return await promise
  } catch {
    return []
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
