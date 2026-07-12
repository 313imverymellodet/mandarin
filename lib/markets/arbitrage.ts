import type { RiskLevel } from "./types"

/**
 * Pure arbitrage math. All functions here are deterministic and
 * side-effect free so they can be unit-tested independently of any API.
 */

/** Convert decimal odds (e.g. 2.10) to an implied probability percentage. */
export function decimalToImpliedPct(decimal: number): number {
  if (!Number.isFinite(decimal) || decimal <= 1) return 100
  return 100 / decimal
}

/** Convert American odds (e.g. -150, +130) to decimal odds. */
export function americanToDecimal(american: number): number {
  if (american > 0) return american / 100 + 1
  return 100 / Math.abs(american) + 1
}

export interface OutcomeQuote {
  outcome: string
  bookmaker: string
  decimal: number
}

export interface ArbResult {
  /** The best-priced quote for each distinct outcome. */
  legs: OutcomeQuote[]
  /** Guaranteed edge percentage: 100 - sum of implied probabilities. */
  edgePct: number
}

/**
 * Given every bookmaker quote for a single event, pick the best (highest
 * decimal payout) quote per outcome and determine whether backing all
 * outcomes across those books yields a guaranteed profit.
 *
 * Returns null when the market is one-sided or no positive edge exists.
 */
export function findBestArbitrage(quotes: OutcomeQuote[]): ArbResult | null {
  if (quotes.length < 2) return null

  const bestByOutcome = new Map<string, OutcomeQuote>()
  for (const quote of quotes) {
    if (!Number.isFinite(quote.decimal) || quote.decimal <= 1) continue
    const current = bestByOutcome.get(quote.outcome)
    if (!current || quote.decimal > current.decimal) {
      bestByOutcome.set(quote.outcome, quote)
    }
  }

  const legs = [...bestByOutcome.values()]
  // Need at least two mutually exclusive outcomes to hedge.
  if (legs.length < 2) return null

  const impliedSum = legs.reduce((sum, leg) => sum + decimalToImpliedPct(leg.decimal), 0)
  const edgePct = round2(100 - impliedSum)
  if (edgePct <= 0) return null

  return { legs, edgePct }
}

/**
 * Optimal stake split for a two/three-way arbitrage so every outcome
 * returns the same payout. Returns the fraction of bankroll per leg.
 */
export function stakeSplit(legs: OutcomeQuote[]): number[] {
  const inverse = legs.map((leg) => 1 / leg.decimal)
  const total = inverse.reduce((a, b) => a + b, 0)
  return inverse.map((i) => i / total)
}

/**
 * Risk heuristic. A very large "edge" on a real market usually means a
 * stale line that will be pulled before you can place both legs, so we
 * treat outliers as higher risk, not lower.
 */
export function riskForEdge(edgePct: number, hoursUntilEvent: number): RiskLevel {
  if (edgePct >= 5 || hoursUntilEvent < 1) return "high"
  if (edgePct >= 2 || hoursUntilEvent < 6) return "medium"
  return "low"
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
