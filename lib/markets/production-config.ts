import type { ArbitrageOptions } from "./arbitrage"
import type { EdgeOptions } from "./edge"
import type { MiddleOptions } from "./middles"
import type { PortfolioOptions } from "./portfolio"

/** Inputs that must come from the deterministic request/event context. */
export interface ProductionEdgeContext {
  asOf: string
  eventTime: string
  eligibleBookmakers: readonly string[]
  sharpBookmakers?: readonly string[]
  bookmakerWeights?: Readonly<Record<string, number>>
  bookmakerCorrelationGroups?: Readonly<Record<string, string>>
}

/** Inputs for the middle candidate engine. */
export interface ProductionMiddleContext {
  sportKey: string
  asOf: string
  eventTime: string
  eligibleBookmakers: readonly string[]
  sharpBookmakers?: readonly string[]
  homeTeam?: string
  awayTeam?: string
  bookmakerWeights?: Readonly<Record<string, number>>
  bookmakerCorrelationGroups?: Readonly<Record<string, string>>
  /** Only set after held-out calibration for this exact sport/market model. */
  calibrationId?: string
  allowActionable?: boolean
}

/**
 * Production-oriented arbitrage gates. Callers still supply the request's
 * deterministic observation timestamp. A second validation should run directly
 * before displaying final stake amounts or opening book links.
 */
export function buildProductionArbitrageOptions(asOf: string): ArbitrageOptions {
  return {
    asOf,
    requireQuoteTimestamps: true,
    maxQuoteAgeSeconds: 60,
    maxQuoteSkewSeconds: 30,
    maxFutureQuoteSkewSeconds: 5,
    requireDistinctBookmakers: true,
    minimumEdgePct: 0.15,
    maximumDecimal: 1_001,
    // Haircut only applies to the profit component of decimal odds.
    decimalHaircutFraction: 0.0025,
  }
}

/**
 * Balanced production +EV configuration. It is intentionally stricter than the
 * library's general-purpose defaults and sizes from buffered, not headline, EV.
 */
export function buildProductionEdgeOptions(
  context: ProductionEdgeContext,
): EdgeOptions {
  return {
    riskProfile: "balanced",
    asOf: context.asOf,
    eventTime: context.eventTime,
    eligibleBookmakers: context.eligibleBookmakers,
    sharpBookmakers: context.sharpBookmakers ?? ["pinnacle"],
    ...(context.bookmakerWeights
      ? { bookmakerWeights: context.bookmakerWeights }
      : {}),
    ...(context.bookmakerCorrelationGroups
      ? { bookmakerCorrelationGroups: context.bookmakerCorrelationGroups }
      : {}),
    excludeTargetBookFromAnchor: true,
    blendSharpWithConsensus: true,
    devigMethod: "power",
    uncertaintyDevigMethods: ["proportional", "power", "shin"],
    minConsensusBooks: 3,
    requireQuoteTimestamps: true,
    maxAnchorQuoteAgeSeconds: 180,
    maxBookSideTimestampSkewSeconds: 15,
    maxTargetQuoteAgeSeconds: 90,
    maxFutureQuoteSkewSeconds: 5,
    maxTargetAnchorSkewSeconds: 60,
    minimumRawEv: 0.025,
    minimumConservativeEv: 0.01,
    minimumNetEv: 0.005,
    minimumConfidence: 70,
    executionBufferEv: 0.005,
    ageExecutionBufferEv: 0.003,
    skewExecutionBufferEv: 0.004,
    kellyFraction: 0.25,
    maximumKellyStakeFraction: 0.01,
    minimumMinutesBeforeEvent: 10,
    allowThreeWayPerOutcomeCalibration: false,
  }
}

/**
 * Production middle configuration. The default is candidate-only. Enabling
 * actionability requires both `allowActionable: true` and a non-empty held-out
 * calibration ID, and should remain controlled by a server-side feature flag.
 */
export function buildProductionMiddleOptions(
  context: ProductionMiddleContext,
): MiddleOptions {
  const calibrationId = context.calibrationId?.trim()
  const allowActionable = context.allowActionable === true && Boolean(calibrationId)

  return {
    sportKey: context.sportKey,
    asOf: context.asOf,
    eventTime: context.eventTime,
    eligibleBookmakers: context.eligibleBookmakers,
    sharpBookmakers: context.sharpBookmakers ?? ["pinnacle"],
    ...(context.homeTeam ? { homeTeam: context.homeTeam } : {}),
    ...(context.awayTeam ? { awayTeam: context.awayTeam } : {}),
    ...(context.bookmakerWeights
      ? { bookmakerWeights: context.bookmakerWeights }
      : {}),
    ...(context.bookmakerCorrelationGroups
      ? { bookmakerCorrelationGroups: context.bookmakerCorrelationGroups }
      : {}),
    requireQuoteTimestamps: true,
    maxQuoteAgeMs: 3 * 60_000,
    maxTargetQuoteSkewMs: 30_000,
    maxTargetAnchorSkewMs: 60_000,
    maxFutureQuoteSkewMs: 5_000,
    minCompleteBooks: 3,
    minDistinctAnchorPoints: 2,
    fitSigmaFromMarket: true,
    minimumFitQuality: 0.55,
    minimumConfidence: 72,
    minimumConservativeEv: 0.01,
    minimumMiddleProbability: 0.03,
    maximumOutsideLoss: 0.05,
    executionBuffer: 0.004,
    ageExecutionBuffer: 0.003,
    skewExecutionBuffer: 0.004,
    minMinutesBeforeEvent: 15,
    maxCandidates: 6,
    maxJackknifeBooks: 8,
    allowActionable,
    ...(calibrationId ? { calibrationId } : {}),
  }
}

/** Conservative cross-opportunity bankroll and concentration limits. */
export const PRODUCTION_PORTFOLIO_OPTIONS: Readonly<PortfolioOptions> = {
  maxTotalStakeFraction: 0.05,
  maxPerPositionStakeFraction: 0.01,
  maxPerEventStakeFraction: 0.015,
  maxPerBookStakeFraction: 0.025,
  maxPerLeagueStakeFraction: 0.03,
  maxPerCorrelationTagStakeFraction: 0.015,
  minimumAllocationFraction: 0.0005,
  minimumExpectedReturn: 0,
  maxPositionsPerEvent: 1,
  deduplicateCorrelationKeys: true,
  maxStakeFractionByKind: {
    arbitrage: 0.01,
    positive_ev: 0.01,
    middle: 0.005,
  },
}
