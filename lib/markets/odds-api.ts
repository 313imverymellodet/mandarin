import { config } from "@/lib/config"
import { findBestLines, riskForEdge, decimalToImpliedPct, type OutcomeQuote } from "./arbitrage"
import { analyzePositiveEV, type EdgeOpportunity } from "./edge"
import { recordEdgeTelemetry, type TelemetryEvent } from "./telemetry"
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
  williamhill_us: "https://www.caesars.com/sportsbook", // William Hill US rebranded to Caesars
  betrivers: "https://www.betrivers.com",
  espnbet: "https://espnbet.com",
  fanatics: "https://sportsbook.fanatics.com",
  hardrockbet: "https://app.hardrock.bet",
  ballybet: "https://play.ballybet.com",
  fliff: "https://www.getfliff.com",
  pointsbetus: "https://pointsbet.com",
  pinnacle: "https://www.pinnacle.com",
  bovada: "https://www.bovada.lv",
}

/** Display-name overrides where the Odds API label is stale/confusing for US users. */
const BOOK_TITLES: Record<string, string> = {
  espnbet: "ESPN BET", // Odds API labels this "theScore Bet" (a CA-only brand)
  williamhill_us: "Caesars",
}

function leagueLabel(sportKey: string, fallback: string): string {
  return LEAGUE_LABELS[sportKey] ?? fallback ?? sportKey
}

/** Homepage for a book. Falls back to a web search so a link never dead-ends. */
function bookUrl(key: string): string {
  return BOOK_URLS[key.toLowerCase()] ?? `https://www.google.com/search?q=${encodeURIComponent(`${key} sportsbook`)}`
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
  const telemetryEvents: TelemetryEvent[] = []

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

    // Edge Engine V2 (+EV): leave-one-book-out sharp/consensus anchor, Power
    // de-vig, uncertainty-adjusted net EV, conservative capped Kelly. Pinnacle
    // anchors fair value but is never an eligible bet target. Flag-gated:
    // disabled → skip entirely; each target is judged by an anchor that
    // excludes itself, so a book can never move its own benchmark.
    const v2 = config.oddsApi.v2
    const analysis = v2.enabled
      ? analyzePositiveEV(anchorQuotes, {
          riskProfile: v2.defaultProfile,
          sharpBookmakers: config.oddsApi.sharpBooks,
          eligibleBookmakers: config.oddsApi.books,
          devigMethod: "power",
          excludeTargetBookFromAnchor: true,
          requireQuoteTimestamps: v2.requireTimestamps,
          minConsensusBooks: config.oddsApi.edge.minConsensusBooks,
          targetBookCount: config.oddsApi.edge.targetBookCount,
          agreementStdevCeiling: config.oddsApi.edge.agreementStdevCeiling,
          eventTime: event.commence_time,
          asOf,
        })
      : null
    const edgeBest: EdgeOpportunity | null = analysis?.best ?? null

    // Shadow telemetry: retain the full analysis (including rejected
    // evaluations) so the model can later be scored on closing-line value.
    if (analysis) {
      telemetryEvents.push({
        eventId: `oddsapi-${event.id}`,
        league: leagueLabel(event.sport_key, event.sport_title),
        matchup: `${event.away_team} @ ${event.home_team}`,
        commenceTime: event.commence_time,
        analysis,
      })
    }

    // Shadow mode computes V2 but withholds it from the public feed.
    const surfacedEdge = v2.enabled && !v2.shadowMode ? edgeBest : null

    const isArb = lines.edgePct > 0
    const kind: OpportunityDTO["kind"] = isArb ? "arbitrage" : surfacedEdge ? "positive_ev" : "watch"

    // Arbitrage keeps priority; +EV is displayed and retained but never labeled
    // as guaranteed profit.
    const suspect =
      (isArb && lines.edgePct > config.oddsApi.maxBelievableEdge) ||
      (kind === "positive_ev" && surfacedEdge !== null && surfacedEdge.confidence < 55)

    const riskLevel: OpportunityDTO["riskLevel"] = isArb
      ? riskForEdge(lines.edgePct, hoursUntil)
      : surfacedEdge
        ? surfacedEdge.confidence >= 70
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

    const round2 = (n: number) => Math.round(n * 100) / 100
    const edge: EdgeDTO | undefined = surfacedEdge
      ? {
          version: 2,
          profile: v2.defaultProfile,
          market: "h2h",
          outcome: surfacedEdge.outcome,
          bookmaker: titleForBook(event, surfacedEdge.bookmaker),
          decimal: surfacedEdge.decimal,
          fairDecimal: round2(surfacedEdge.fairDecimal),
          fairProbability: surfacedEdge.fairProbability,
          conservativeFairProbability: surfacedEdge.conservativeFairProbability,
          probabilitySigma: surfacedEdge.probabilitySigma,
          rawEvPct: round2(surfacedEdge.evPct),
          conservativeEvPct: round2(surfacedEdge.conservativeEvPct),
          netEvPct: round2(surfacedEdge.netEvPct),
          confidence: surfacedEdge.confidence,
          kellyStakeFraction: surfacedEdge.kellyStakeFraction,
          anchorSource: surfacedEdge.anchorSource,
          anchorMode: surfacedEdge.anchorMode,
          anchorBookmakers: surfacedEdge.anchorBookmakers.map((k) => titleForBook(event, k)),
          effectiveBookCount: surfacedEdge.effectiveBookCount,
          targetQuoteAgeSeconds: surfacedEdge.targetQuoteAgeSeconds,
          ...(surfacedEdge.lastUpdate ? { updatedAt: surfacedEdge.lastUpdate } : {}),
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

  // Best-effort; never awaited, never allowed to fail the odds response.
  recordEdgeTelemetry(sportKey, asOf, telemetryEvents)

  return opportunities
}

function titleForBook(event: OddsApiEvent, bookKey: string): string {
  const key = bookKey.toLowerCase()
  if (BOOK_TITLES[key]) return BOOK_TITLES[key]
  const book = event.bookmakers?.find((b) => b.key.toLowerCase() === key)
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
