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
  /** Direct link to the venue. */
  url: string
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
   * = how far the market is from an arb (shown on "watch" rows).
   */
  arbitrage: number
  /**
   * "arbitrage" = backing every outcome locks in profit right now.
   * "watch" = no guaranteed edge yet; shown so the board stays live and
   * near-arbs are visible before they cross over.
   */
  kind: "arbitrage" | "watch"
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
