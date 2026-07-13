import { config } from "@/lib/config"
import { findBestLines, riskForEdge, decimalToImpliedPct, type OutcomeQuote } from "./arbitrage"
import type { MarketCategory, OpportunityDTO, PlatformQuote } from "./types"

/**
 * The Odds API (https://the-odds-api.com) aggregates decimal prices from
 * many US sportsbooks per event. Because it returns every book's price for
 * every outcome, cross-book arbitrage is computable directly from one
 * response — no cross-provider entity matching required.
 */

interface OddsApiOutcome {
  name: string
  price: number
}
interface OddsApiMarket {
  key: string
  outcomes: OddsApiOutcome[]
}
interface OddsApiBookmaker {
  key: string
  title: string
  last_update: string
  markets: OddsApiMarket[]
}
interface OddsApiEvent {
  id: string
  sport_key: string
  sport_title: string
  commence_time: string
  home_team: string
  away_team: string
  bookmakers: OddsApiBookmaker[]
}

const LEAGUE_LABELS: Record<string, string> = {
  americanfootball_nfl: "NFL",
  americanfootball_ncaaf: "CFB",
  basketball_nba: "NBA",
  basketball_ncaab: "NCAAB",
  baseball_mlb: "MLB",
  icehockey_nhl: "NHL",
  mma_mixed_martial_arts: "UFC",
}

const BOOK_URLS: Record<string, string> = {
  draftkings: "https://sportsbook.draftkings.com",
  fanduel: "https://sportsbook.fanduel.com",
  betmgm: "https://sports.betmgm.com",
  caesars: "https://www.caesars.com/sportsbook",
  betrivers: "https://betrivers.com",
  pointsbetus: "https://pointsbet.com",
  williamhill_us: "https://www.williamhill.com",
  bovada: "https://www.bovada.lv",
}

function leagueLabel(sportKey: string, fallback: string): string {
  return LEAGUE_LABELS[sportKey] ?? fallback ?? sportKey
}

function bookUrl(key: string): string {
  return BOOK_URLS[key] ?? "https://the-odds-api.com"
}

function categoryForSport(sportKey: string): MarketCategory {
  return sportKey.startsWith("politics") ? "politics" : "sports"
}

/**
 * Fetch h2h odds for one sport. Returns every upcoming event priced at the
 * best available line per outcome: positive-edge events are flagged as
 * "arbitrage", the rest as "watch" so the board always shows live markets.
 */
async function fetchSportArbs(sportKey: string): Promise<OpportunityDTO[]> {
  const url = new URL(`${config.oddsApi.baseUrl}/sports/${sportKey}/odds`)
  url.searchParams.set("apiKey", config.oddsApi.key!)
  url.searchParams.set("regions", config.oddsApi.regions)
  url.searchParams.set("markets", "h2h")
  url.searchParams.set("oddsFormat", "decimal")

  const res = await fetch(url, { next: { revalidate: Math.floor(config.cacheTtlMs / 1000) } })
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    if (body.includes("OUT_OF_USAGE_CREDITS")) {
      throw new Error("Odds provider monthly quota reached — live odds resume after the quota resets or you upgrade the plan.")
    }
    if (res.status === 401) {
      throw new Error("Odds provider rejected the API key (401) — check ODDS_API_KEY.")
    }
    throw new Error(`Odds API ${sportKey} responded ${res.status}: ${body.slice(0, 200)}`)
  }
  const events = (await res.json()) as OddsApiEvent[]
  if (!Array.isArray(events)) return []

  const now = Date.now()
  const allowedBooks = new Set(config.oddsApi.books)
  const staleBefore = now - config.oddsApi.maxQuoteAgeMs
  const opportunities: OpportunityDTO[] = []

  for (const event of events) {
    const quotes: OutcomeQuote[] = []
    for (const book of event.bookmakers ?? []) {
      // Only books you can actually bet at, and only fresh prices.
      if (allowedBooks.size > 0 && !allowedBooks.has(book.key)) continue
      const updatedAt = book.last_update ? new Date(book.last_update).getTime() : NaN
      if (Number.isFinite(updatedAt) && updatedAt < staleBefore) continue

      const h2h = book.markets?.find((m) => m.key === "h2h")
      if (!h2h) continue
      for (const outcome of h2h.outcomes ?? []) {
        if (typeof outcome.price === "number") {
          quotes.push({ outcome: outcome.name, bookmaker: book.key, decimal: outcome.price, lastUpdate: book.last_update })
        }
      }
    }

    const lines = findBestLines(quotes)
    if (!lines) continue

    const eventTime = new Date(event.commence_time)
    if (Number.isNaN(eventTime.getTime()) || eventTime.getTime() <= now) continue
    const hoursUntil = (eventTime.getTime() - now) / 3_600_000

    const isArb = lines.edgePct > 0
    const suspect = isArb && lines.edgePct > config.oddsApi.maxBelievableEdge
    const platforms: PlatformQuote[] = lines.legs.map((leg) => ({
      name: titleForBook(event, leg.bookmaker),
      outcome: leg.outcome,
      odds: Math.round(decimalToImpliedPct(leg.decimal) * 10) / 10,
      decimal: leg.decimal,
      updatedAt: leg.lastUpdate,
      url: bookUrl(leg.bookmaker),
    }))

    opportunities.push({
      id: `oddsapi-${event.id}`,
      matchup: `${event.away_team} @ ${event.home_team}`,
      league: leagueLabel(event.sport_key, event.sport_title),
      category: categoryForSport(event.sport_key),
      platforms,
      arbitrage: lines.edgePct,
      kind: isArb ? "arbitrage" : "watch",
      suspect,
      riskLevel: isArb ? riskForEdge(lines.edgePct, hoursUntil) : "low",
      eventTime: eventTime.toISOString(),
      lastUpdated: new Date().toISOString(),
    })
  }

  return opportunities
}

function titleForBook(event: OddsApiEvent, bookKey: string): string {
  const book = event.bookmakers?.find((b) => b.key === bookKey)
  return book?.title ?? bookKey
}

/** Fetch and combine arbitrage opportunities across all configured sports. */
export async function fetchOddsApiOpportunities(): Promise<OpportunityDTO[]> {
  const results = await Promise.allSettled(config.oddsApi.sports.map(fetchSportArbs))
  const opportunities: OpportunityDTO[] = []
  const errors: string[] = []
  for (const result of results) {
    if (result.status === "fulfilled") opportunities.push(...result.value)
    else errors.push(String(result.reason?.message ?? result.reason))
  }
  // If every sport failed, surface the error so the caller can mark the source down.
  if (opportunities.length === 0 && errors.length === config.oddsApi.sports.length) {
    throw new Error(errors[0] ?? "Odds API request failed")
  }
  return opportunities
}
