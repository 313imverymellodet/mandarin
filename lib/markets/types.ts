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
 * A de-vigged positive-EV opportunity: a single book pricing one outcome
 * better than the sharp/consensus fair value. Estimated long-run edge — NOT
 * guaranteed profit like an arbitrage.
 */
export interface EdgeDTO {
  market: "h2h" | "spreads" | "totals"
  outcome: string
  /** Bookmaker to place the bet at (display name, e.g. "DraftKings"). */
  bookmaker: string
  decimal: number
  /** Canonical 0..1 fair probability. */
  fairProbability: number
  /** UI-ready percentages. */
  fairProbabilityPct: number
  evPct: number
  kellyStakeFraction: number
  kellyStakePct: number
  /** 0..100 confidence — depth/agreement/anchor/timing. NOT a win probability. */
  confidence: number
  anchorSource: "sharp" | "consensus"
  anchorBookmaker?: string
  booksQuoting: number
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
