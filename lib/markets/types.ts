/**
 * Canonical, JSON-serializable shapes returned by the market API routes.
 * Dates are ISO strings on the wire; the client hook revives them.
 */

export type MarketCategory = "sports" | "politics" | "crypto" | "entertainment"
export type RiskLevel = "low" | "medium" | "high"

export interface PlatformQuote {
  /** Bookmaker / venue name, e.g. "DraftKings", "Kalshi". */
  name: string
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
  /** Guaranteed edge in percent: 100 - sum(implied probabilities). */
  arbitrage: number
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

export interface TickerMarketDTO {
  id: string
  title: string
  venue: string
  yes: string
  no: string
  volume?: string
  eventTime?: string
}

export interface TickerResponse {
  markets: TickerMarketDTO[]
  generatedAt: string
}
