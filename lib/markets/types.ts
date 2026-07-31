/**
 * Canonical JSON-serializable shapes returned by Mandarin's market API.
 * Dates stay as ISO strings on the wire so the same contracts work in Node,
 * Vercel serverless, and the browser.
 */

export type MarketCategory = "sports" | "politics" | "crypto" | "entertainment"
export type RiskLevel = "low" | "medium" | "high"
export type MarketKey = "h2h" | "spreads" | "totals"
export type OpportunityKind = "arbitrage" | "positive_ev" | "middle" | "watch"

export interface PlatformQuote {
  /** Stable Odds API bookmaker key when available. */
  key?: string
  /** Display name, e.g. "DraftKings". */
  name: string
  /** Team, fighter, Draw, Over, or Under. */
  outcome?: string
  /** Spread or total point. Undefined for h2h. */
  point?: number
  /** Market represented by this quote. */
  market?: MarketKey
  /** Implied probability percentage, retained for existing UI compatibility. */
  odds: number
  /** Raw decimal odds. */
  decimal?: number
  /** Bookmaker quote timestamp. */
  updatedAt?: string
  /** Sportsbook destination URL. */
  url: string
}

export interface ArbitrageLegDTO {
  bookmaker: string
  bookmakerKey?: string
  outcome: string
  decimal: number
  point?: number
  stakeFraction: number
  updatedAt?: string
  url: string
}

/** Exact equal-payout staking plan for a 2-way or 3-way arbitrage. */
export interface ArbitrageDTO {
  version: 2
  market: MarketKey
  lineKey: string
  totalImpliedProbability: number
  edgePct: number
  /** Edge after the configured price-movement haircut. */
  stressedEdgePct: number
  guaranteedReturnMultiple: number
  /** Theoretical equal-payout ROI before currency rounding. */
  guaranteedRoiPct: number
  quoteSkewSeconds: number | null
  oldestQuoteAgeSeconds: number | null
  legs: ArbitrageLegDTO[]
}

/**
 * A de-vigged positive-EV opportunity from Edge Engine V3. It is an estimate
 * of long-run price value, not a guarantee that this wager wins.
 */
export interface EdgeDTO {
  version: 3
  profile: "conservative" | "balanced" | "aggressive"
  /** Edge Engine V3 intentionally evaluates h2h only. */
  market: "h2h"
  outcome: string
  bookmaker: string
  bookmakerKey?: string
  decimal: number
  fairDecimal: number
  fairProbability: number
  conservativeFairProbability: number
  probabilitySigma: number
  rawEvPct: number
  conservativeEvPct: number
  /** Headline EV after uncertainty and the age/skew-aware execution buffer. */
  netEvPct: number
  executionBufferEvPct: number
  executionAdjustedProbability: number
  /** Expected log-bankroll growth at the recommended stake. */
  expectedLogGrowth: number
  /** 0-100 signal quality, not win probability. */
  confidence: number
  /** Suggested bankroll fraction after conservative fractional Kelly and caps. */
  kellyStakeFraction: number
  anchorSource: "sharp" | "consensus"
  anchorMode: "single_sharp" | "sharp_blend" | "consensus"
  anchorBookmakers: string[]
  effectiveBookCount: number
  targetQuoteAgeSeconds: number | null
  targetAnchorSkewSeconds: number | null
  isActionable: boolean
  rejectionReasons: string[]
  updatedAt?: string
}

export interface MiddleLegDTO {
  bookmaker: string
  bookmakerKey?: string
  outcome: string
  point: number
  decimal: number
  stakeFraction: number
  updatedAt?: string
  url: string
}

export interface MiddleWindowDTO {
  /** Strict lower settlement threshold in the canonical score variable. */
  lowerBound: number
  /** Strict upper settlement threshold in the canonical score variable. */
  upperBound: number
  /** Integer results where both wagers win. Capped for transport/UI safety. */
  landingValues: number[]
  /** Human-readable window, e.g. "221-222" or "Team A loses by 3". */
  label: string
}

/**
 * A two-book spread/total middle. Central and conservative EV use a transparent
 * discrete score model; candidate rows stay clearly separated from actionable
 * rows when the model or data quality is insufficient.
 */
export interface MiddleDTO {
  version: 3
  status: "actionable" | "candidate"
  market: "spreads" | "totals"
  modelVersion: "market-ladder-discrete-normal-v3"
  calibrationId?: string
  referenceOutcome?: string
  window: MiddleWindowDTO
  legs: [MiddleLegDTO, MiddleLegDTO]
  bothWinProfitPct: number
  /** Balanced one-leg-win result; normally a small loss caused by vig. */
  outsideWindowProfitPct: number
  /** Profit when the lower boundary pushes and the other leg wins. */
  lowerPushProfitPct: number | null
  /** Profit when the upper boundary pushes and the other leg wins. */
  upperPushProfitPct: number | null
  breakEvenMiddleProbability: number
  estimatedMiddleProbability: number
  conservativeMiddleProbability: number
  probabilityBreakdown: {
    bothWin: number
    legAOnly: number
    legBOnly: number
    pushMix: number
    bothLoss: number
  }
  rawEvPct: number
  conservativeEvPct: number
  executionBufferAppliedPct: number
  confidence: number
  effectiveBookCount: number
  correlationGroupCount: number
  sharpAnchorPresent: boolean
  modelMean: number
  modelSigma: number
  priorSigma: number
  fitMethod: "prior_sigma" | "market_ladder"
  fitRmse: number
  fitQuality: number
  meanUncertainty: number
  observationCount: number
  distinctPointCount: number
  methodDisagreement: number
  jackknifeMeanShift: number
  jackknifeSigmaFraction: number
  keyNumbersInWindow: number[]
  quoteAgeSeconds: number | null
  targetQuoteSkewSeconds: number | null
  targetAnchorSkewSeconds: number | null
  anchorBookmakers: string[]
  excludedBookmakers: [string, string]
  rejectionReasons: string[]
  updatedAt?: string
}


export interface PortfolioAllocationDTO {
  allocatedStakeFraction: number
  expectedProfitFraction: number
  wasClipped: boolean
  bookmakerStakeFractions: { bookmaker: string; stakeFraction: number }[]
}

export interface OpportunityDTO {
  id: string
  matchup: string
  league: string
  category: MarketCategory
  market: MarketKey
  platforms: PlatformQuote[]
  /** Existing compatibility field: positive only for a true cross-book arb. */
  arbitrage: number
  kind: OpportunityKind
  arb?: ArbitrageDTO
  edge?: EdgeDTO
  middle?: MiddleDTO
  /** Optional cross-opportunity bankroll allocation after concentration caps. */
  portfolio?: PortfolioAllocationDTO
  suspect: boolean
  edgeDelta1h?: number
  edgeDelta6h?: number
  spark?: number[]
  riskLevel: RiskLevel
  eventTime: string
  /** When Mandarin fetched this exact snapshot from the upstream API. */
  observedAt?: string
  /** Most recent bookmaker-reported line update among displayed legs. */
  lastUpdated: string
}

export interface OddsQuotaDTO {
  requestsUsed?: number
  requestsRemaining?: number
  lastRequestCost?: number
  estimatedMonthlyCredits?: number
  configuredMonthlyBudget?: number
  warning?: string
}

export interface SourceStatus {
  id: "odds-api" | "kalshi" | "polymarket"
  label: string
  enabled: boolean
  ok: boolean
  message?: string
  quota?: OddsQuotaDTO
}

export interface OpportunitiesResponse {
  opportunities: OpportunityDTO[]
  sources: SourceStatus[]
  degraded: boolean
  generatedAt: string
}

export interface TickerSide {
  label: string
  price: string
}

export interface TickerMarketDTO {
  id: string
  matchup: string
  league: string
  sides: TickerSide[]
  eventTime?: string
}

export interface TickerResponse {
  markets: TickerMarketDTO[]
  generatedAt: string
}
