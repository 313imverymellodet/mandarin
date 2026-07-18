/**
 * Canonical, JSON-serializable shapes returned by the market API routes.
 * Dates are ISO strings on the wire; the client hook revives them.
 */

export type MarketCategory = "sports" | "politics" | "crypto" | "entertainment"
export type RiskLevel = "low" | "medium" | "high"

export interface PlatformQuote {
  /** Bookmaker / venue name, e.g. "DraftKings", "Kalshi". */
  name: string
  /** The outcome/team this quote is for, e.g. "Los Angeles Dodgers". */
  outcome?: string
  /** Implied probability for the chosen side, as a percentage (0-100). */
  odds: number
  /** The raw decimal odds we bought at (sportsbooks only), for the calculator. */
  decimal?: number
  /** ISO timestamp of when this book last moved the price (freshness). */
  updatedAt?: string
  /** Direct link to the venue. */
  url: string
}

/**
 * A de-vigged positive-EV opportunity (Edge Engine V2): a single book pricing
 * one outcome better than a target-excluded sharp/consensus fair value.
 * Estimated long-run edge after an uncertainty haircut and execution buffer —
 * NOT guaranteed profit like an arbitrage.
 */
export interface EdgeDTO {
  version: 2
  profile: "conservative" | "balanced" | "aggressive"
  market: "h2h" | "spreads" | "totals"
  outcome: string
  /** Bookmaker to place the bet at (display name, e.g. "DraftKings"). */
  bookmaker: string
  decimal: number
  /** Fair (no-vig) decimal price implied by the anchor. */
  fairDecimal: number
  /** Canonical 0..1 fair probability. */
  fairProbability: number
  /** Fair probability minus the uncertainty haircut (0..1) — Kelly uses this. */
  conservativeFairProbability: number
  /** Estimated 1-sigma uncertainty on the fair probability. */
  probabilitySigma: number
  /** Raw point-estimate EV%, shown only in details. */
  rawEvPct: number
  /** EV% using the conservative probability. */
  conservativeEvPct: number
  /** Headline: conservative EV% after the execution buffer. */
  netEvPct: number
  /** 0..100 signal-quality score — data/model quality, NOT a win probability. */
  confidence: number
  /** Suggested bankroll fraction (conservative, capped fractional Kelly). */
  kellyStakeFraction: number
  anchorSource: "sharp" | "consensus"
  anchorMode: "single_sharp" | "sharp_blend" | "consensus"
  anchorBookmakers: string[]
  effectiveBookCount: number
  targetQuoteAgeSeconds: number | null
  updatedAt?: string
}

export interface OpportunityDTO {
  id: string
  matchup: string
  league: string
  category: MarketCategory
  platforms: PlatformQuote[]
  /**
   * Edge in percent: 100 - sum(implied probabilities) across the best
   * available line per outcome. Positive = guaranteed arbitrage; negative
   * = how far the market is from an arb (shown on "watch"/"positive_ev" rows).
   */
  arbitrage: number
  /**
   * "arbitrage" = backing every outcome locks in profit right now.
   * "positive_ev" = a single book beats fair value (estimated long-run edge).
   * "watch" = no guaranteed edge yet; shown so the board stays live and
   * near-arbs are visible before they cross over.
   */
  kind: "arbitrage" | "positive_ev" | "watch"
  /** Present on positive_ev rows (and optionally alongside an arb). */
  edge?: EdgeDTO
  /**
   * True when the edge is implausibly large (see config.oddsApi.maxBelievableEdge)
   * — almost always a stale line. Kept visible but flagged so you verify first.
   */
  suspect: boolean
  /** Change in edge (pp) over ~1h / ~6h; undefined until history accrues. */
  edgeDelta1h?: number
  edgeDelta6h?: number
  /** Downsampled edge history (oldest→newest) for a sparkline. */
  spark?: number[]
  riskLevel: RiskLevel
  eventTime: string // ISO
  lastUpdated: string // ISO
}

export interface SourceStatus {
  id: "odds-api" | "kalshi" | "polymarket"
  label: string
  enabled: boolean
  ok: boolean
  message?: string
}

export interface OpportunitiesResponse {
  opportunities: OpportunityDTO[]
  sources: SourceStatus[]
  /** True when every enabled data source failed and results are empty. */
  degraded: boolean
  generatedAt: string
}

export interface TickerSide {
  /** Team / outcome name. */
  label: string
  /** Best implied probability across books, formatted e.g. "45%". */
  price: string
}

export interface TickerMarketDTO {
  id: string
  /** "Away @ Home" — used for the title attribute / a11y. */
  matchup: string
  league: string
  sides: TickerSide[]
  eventTime?: string
}

export interface TickerResponse {
  markets: TickerMarketDTO[]
  generatedAt: string
}
