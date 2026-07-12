import { config } from "@/lib/config"
import { fetchOddsApiOpportunities } from "./odds-api"
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

/**
 * The ticker is derived from the same cached opportunities feed — no extra
 * upstream calls — so it always mirrors the live sportsbook games on the
 * dashboard (soonest first).
 */
export async function getTicker(): Promise<TickerResponse> {
  const { opportunities } = await getOpportunities()

  const markets: TickerMarketDTO[] = [...opportunities]
    .sort((a, b) => new Date(a.eventTime).getTime() - new Date(b.eventTime).getTime())
    .slice(0, 14)
    .map((o) => ({
      id: o.id,
      matchup: o.matchup,
      league: o.league,
      sides: o.platforms.map((p) => ({
        label: shortenTeam(p.outcome, o.league) ?? p.name,
        price: `${Math.round(p.odds)}%`,
      })),
      eventTime: o.eventTime,
    }))

  return { markets, generatedAt: new Date().toISOString() }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * Shorten to the mascot/last name for leagues where that reads cleanly
 * ("Los Angeles Dodgers" -> "Dodgers", fighters -> surname). Soccer clubs
 * end in FC/SC/CF, so keep their full name and let the UI truncate.
 */
function shortenTeam(name: string | undefined, league: string): string | undefined {
  if (!name) return undefined
  if (league === "MLS" || league === "Soccer" || league === "Draw") return name
  const parts = name.trim().split(/\s+/)
  if (parts.length <= 1) return name
  if (name === "Draw") return name
  const twoWordSuffix = ["Red Sox", "White Sox", "Blue Jays", "Trail Blazers", "Maple Leafs", "Golden Knights"]
  const lastTwo = parts.slice(-2).join(" ")
  if (twoWordSuffix.includes(lastTwo)) return lastTwo
  return parts[parts.length - 1]
}
