import { config } from "@/lib/config"
import { findBestLines, riskForEdge, decimalToImpliedPct, type OutcomeQuote } from "./arbitrage"
import { analyzePositiveEV } from "./edge"
import type { EdgeDTO, MarketCategory, OpportunityDTO, PlatformQuote } from "./types"

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
  // Request the sharp anchor (Pinnacle) + eligible US books by exact key. ≤10
  // books keeps this a single quota unit — same cost as one region.
  url.searchParams.set("bookmakers", config.oddsApi.requestBookmakers.join(","))
  url.searchParams.set("markets", "h2h")
  url.searchParams.set("oddsFormat", "decimal")

  // Always fetch fresh from upstream; our in-process cache (lib/markets/index.ts)
  // is the single layer that controls refresh cadence. Relying on Next's fetch
  // Data Cache here caused intermittent stale-empty responses (served [] while
  // revalidating in the background).
  const res = await fetch(url, { cache: "no-store" })
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
  // One deterministic timestamp per API response, captured outside the loop.
  const asOf = new Date(now).toISOString()
  const usBooks = new Set(config.oddsApi.books)
  const staleBefore = now - config.oddsApi.maxQuoteAgeMs
  const opportunities: OpportunityDTO[] = []

  for (const event of events) {
    // Fresh quotes from every requested book, INCLUDING the sharp anchor
    // (Pinnacle). Stale prices — including a stale anchor — are dropped here so
    // they can never produce a high-confidence phantom edge.
    const anchorQuotes: OutcomeQuote[] = []
    for (const book of event.bookmakers ?? []) {
      const updatedAt = book.last_update ? new Date(book.last_update).getTime() : NaN
      if (Number.isFinite(updatedAt) && updatedAt < staleBefore) continue

      const h2h = book.markets?.find((m) => m.key === "h2h")
      if (!h2h) continue
      for (const outcome of h2h.outcomes ?? []) {
        if (typeof outcome.price === "number") {
          anchorQuotes.push({
            outcome: outcome.name,
            bookmaker: book.key.toLowerCase(),
            decimal: outcome.price,
            lastUpdate: book.last_update,
          })
        }
      }
    }

    // Actionable US-book quotes drive existing arbitrage + the displayed lines.
    const usQuotes = anchorQuotes.filter((q) => usBooks.has(q.bookmaker))

    const lines = findBestLines(usQuotes)
    if (!lines) continue

    const eventTime = new Date(event.commence_time)
    if (Number.isNaN(eventTime.getTime()) || eventTime.getTime() <= now) continue
    const hoursUntil = (eventTime.getTime() - now) / 3_600_000

    // +EV: de-vig a sharp (or consensus) anchor and compare eligible US books
    // against fair value. Pinnacle anchors but is never an eligible bet target.
    const edgeBest =
      analyzePositiveEV(anchorQuotes, {
        sharpBookmakers: config.oddsApi.sharpBooks,
        minConsensusBooks: config.oddsApi.edge.minConsensusBooks,
        eligibleBookmakers: config.oddsApi.books,
        minimumEv: config.oddsApi.edge.minimumEv,
        kellyFraction: config.oddsApi.edge.kellyFraction,
        targetBookCount: config.oddsApi.edge.targetBookCount,
        agreementStdevCeiling: config.oddsApi.edge.agreementStdevCeiling,
        eventTime: event.commence_time,
        asOf,
      })?.best ?? null

    const isArb = lines.edgePct > 0
    const kind: OpportunityDTO["kind"] = isArb ? "arbitrage" : edgeBest ? "positive_ev" : "watch"

    // Arbitrage keeps priority; +EV is displayed and retained but never labeled
    // as guaranteed profit.
    const suspect =
      (isArb && lines.edgePct > config.oddsApi.maxBelievableEdge) ||
      (kind === "positive_ev" && edgeBest !== null && edgeBest.confidence < 55)

    const riskLevel: OpportunityDTO["riskLevel"] = isArb
      ? riskForEdge(lines.edgePct, hoursUntil)
      : edgeBest
        ? edgeBest.confidence >= 70
          ? "medium"
          : "high"
        : "low"

    const platforms: PlatformQuote[] = lines.legs.map((leg) => ({
      name: titleForBook(event, leg.bookmaker),
      outcome: leg.outcome,
      odds: Math.round(decimalToImpliedPct(leg.decimal) * 10) / 10,
      decimal: leg.decimal,
      updatedAt: leg.lastUpdate,
      url: bookUrl(leg.bookmaker),
    }))

    const edge: EdgeDTO | undefined = edgeBest
      ? {
          market: "h2h",
          outcome: edgeBest.outcome,
          bookmaker: titleForBook(event, edgeBest.bookmaker),
          decimal: edgeBest.decimal,
          fairProbability: edgeBest.fairProbability,
          fairProbabilityPct: Math.round(edgeBest.fairProbabilityPct * 10) / 10,
          evPct: Math.round(edgeBest.evPct * 100) / 100,
          kellyStakeFraction: edgeBest.kellyStakeFraction,
          kellyStakePct: Math.round(edgeBest.kellyStakePct * 100) / 100,
          confidence: edgeBest.confidence,
          anchorSource: edgeBest.anchorSource,
          ...(edgeBest.anchorBookmaker ? { anchorBookmaker: titleForBook(event, edgeBest.anchorBookmaker) } : {}),
          booksQuoting: edgeBest.booksQuoting,
          ...(edgeBest.lastUpdate ? { updatedAt: edgeBest.lastUpdate } : {}),
        }
      : undefined

    opportunities.push({
      id: `oddsapi-${event.id}`,
      matchup: `${event.away_team} @ ${event.home_team}`,
      league: leagueLabel(event.sport_key, event.sport_title),
      category: categoryForSport(event.sport_key),
      platforms,
      arbitrage: lines.edgePct,
      kind,
      ...(edge ? { edge } : {}),
      suspect,
      riskLevel,
      eventTime: eventTime.toISOString(),
      lastUpdated: asOf,
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
