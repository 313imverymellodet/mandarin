import type { OutcomeQuote } from "./arbitrage"

const EPSILON = 1e-12
const PROBABILITY_EPSILON = 1e-9
const DEFAULT_SHARP_BOOKMAKERS = ["pinnacle"] as const
const DEFAULT_UNCERTAINTY_METHODS = ["proportional", "power", "shin"] as const

/** Supported margin-removal methods for complete 2-way and 3-way markets. */
export type DevigMethod = "proportional" | "power" | "shin"

/** User-facing quality/volume profile. It is not a promise of profit or hit rate. */
export type EdgeRiskProfile = "conservative" | "balanced" | "aggressive"

/** Whether at least one configured sharp book materially informed fair value. */
export type FairValueSource = "sharp" | "consensus"

/** More specific description of how the public fair-value anchor was formed. */
export type FairValueAnchorMode = "single_sharp" | "sharp_blend" | "consensus"

/** Optional post-hoc probability calibration learned outside this pure module. */
export type ProbabilityCalibration =
  | {
      kind: "beta"
      /** Coefficient applied to ln(p). Identity calibration uses 1. */
      logProbabilityCoefficient: number
      /** Coefficient applied to ln(1-p). Identity calibration uses -1. */
      logOneMinusProbabilityCoefficient: number
      /** Logistic intercept. Identity calibration uses 0. */
      intercept: number
    }
  | {
      kind: "isotonic"
      /** Monotone fitted points. This module uses piecewise-linear interpolation. */
      points: readonly { predicted: number; calibrated: number }[]
    }

/** One outcome's estimated fair probability. */
export interface FairProbability {
  outcome: string
  probability: number
}

/** Audit data for a bookmaker that contributed to a fair-value anchor. */
export interface AnchorBookWeight {
  bookmaker: string
  normalizedWeight: number
  isSharp: boolean
  overround: number
  freshness: number
  ageSeconds: number | null
  outlierMultiplier: number
}

/** Fair-value estimate and the diagnostics used to form it. */
export interface FairValueAnchor {
  source: FairValueSource
  mode: FairValueAnchorMode
  bookmaker?: string
  excludedBookmaker?: string
  probabilities: FairProbability[]
  contributingBookmakers: string[]
  overround: number
  effectiveBookCount: number
  sharpWeightShare: number
  weightedFreshness: number
  probabilityStdevs: number[]
  methodStdevs: number[]
  probabilitySigmas: number[]
  bookWeights: AnchorBookWeight[]
}

/** Components behind the 0-100 signal-quality score. */
export interface ConfidenceBreakdown {
  /** Backward-compatible alias for effective depth, in the 0..1 range. */
  books: number
  agreement: number
  sharpAnchor: number
  timeToEvent: number
  freshness: number
  targetFreshness: number
  modelStability: number
  meanProbabilityStdev: number | null
  meanMethodStdev: number | null
  effectiveBookCount: number
  sharpWeightShare: number
  targetQuoteAgeSeconds: number | null
  timeToEventHours: number | null
}

/** Reasons a mathematically evaluated quote was not promoted as actionable. */
export type EdgeRejectionReason =
  | "book_not_eligible"
  | "target_quote_timestamp_missing"
  | "target_quote_stale"
  | "event_started"
  | "too_close_to_event"
  | "fair_probability_below_profile"
  | "raw_ev_below_threshold"
  | "conservative_ev_below_threshold"
  | "net_ev_below_threshold"
  | "confidence_below_threshold"

/** Full evaluation of one bookmaker/outcome quote. */
export interface EvaluatedQuote {
  outcome: string
  bookmaker: string
  decimal: number
  fairDecimal: number
  fairProbability: number
  fairProbabilityPct: number
  probabilitySigma: number
  conservativeFairProbability: number
  conservativeFairProbabilityPct: number
  conservativeFairDecimal: number
  /** Raw point-estimate EV as a decimal fraction. */
  ev: number
  evPct: number
  /** EV computed with a lower-confidence probability estimate. */
  conservativeEv: number
  conservativeEvPct: number
  /** Conservative EV after the configured execution/model buffer. */
  netEv: number
  netEvPct: number
  /** Full Kelly from the raw point estimate, retained for diagnostics only. */
  fullKellyFraction: number
  /** Full Kelly from the conservative probability estimate. */
  conservativeFullKellyFraction: number
  /** Conservative fractional Kelly after the hard bankroll cap. */
  kellyStakeFraction: number
  kellyStakePct: number
  confidence: number
  confidenceBreakdown: ConfidenceBreakdown
  anchorSource: FairValueSource
  anchorMode: FairValueAnchorMode
  anchorBookmaker?: string
  anchorBookmakers: string[]
  effectiveBookCount: number
  targetQuoteAgeSeconds: number | null
  isActionable: boolean
  rejectionReasons: EdgeRejectionReason[]
  lastUpdate?: string
}

/** Highest-ranked actionable evaluation for an event. */
export interface EdgeOpportunity extends EvaluatedQuote {
  booksQuoting: number
}

/** Event-level result with all target-specific, leave-one-book-out evaluations. */
export interface EdgeAnalysis {
  /** Global display anchor. Each evaluation still uses its own target-excluded anchor. */
  anchor: FairValueAnchor
  evaluations: EvaluatedQuote[]
  best: EdgeOpportunity | null
  confidence: number
  confidenceBreakdown: ConfidenceBreakdown
  booksQuoting: number
}

/** Configuration for robust fair-value, uncertainty, EV, and staking decisions. */
export interface EdgeOptions {
  /** Quality/volume preset. Defaults to balanced. Explicit fields override it. */
  riskProfile?: EdgeRiskProfile
  /** Ordered sharp-book preference. Defaults to Pinnacle. */
  sharpBookmakers?: readonly string[]
  /** Primary de-vig method. Power is the production default. */
  devigMethod?: DevigMethod
  /** Methods whose disagreement contributes to probability uncertainty. */
  uncertaintyDevigMethods?: readonly DevigMethod[]
  /** Optional fitted calibration map, normally specific to sport/market/time bucket. */
  calibration?: ProbabilityCalibration
  /** Minimum complete non-sharp books when no sharp book remains. */
  minConsensusBooks?: number
  /** Only these books may become the actionable target; all valid books may anchor. */
  eligibleBookmakers?: readonly string[]
  /** Exclude the target bookmaker from the anchor used to judge it. Defaults true. */
  excludeTargetBookFromAnchor?: boolean
  /** Blend fresh consensus books with a sharp book. Defaults true. */
  blendSharpWithConsensus?: boolean
  /** Per-book reliability multipliers, keyed by lowercase bookmaker key. */
  bookmakerWeights?: Readonly<Record<string, number>>
  /** Default multiplier for configured sharp books. */
  sharpBookWeight?: number
  /** Maximum total soft-book weight relative to sharp weight in a sharp blend. */
  maxSoftToSharpWeightRatio?: number
  /** Half-life for anchor quote recency weighting. */
  recencyHalfLifeSeconds?: number
  /** Anchor book is excluded when its oldest required side is older than this. */
  maxAnchorQuoteAgeSeconds?: number
  /** Target quote is not actionable when older than this. */
  maxTargetQuoteAgeSeconds?: number
  /** Exclude quotes without parseable timestamps when true. */
  requireQuoteTimestamps?: boolean
  /** Recency multiplier for missing timestamps when timestamps are not required. */
  missingTimestampWeight?: number
  /** Smallest plausible complete-market implied-probability sum. */
  minimumOverround?: number
  /** Largest plausible complete-market implied-probability sum. */
  maximumOverround?: number
  /** Strength of the modest low-hold weighting. */
  holdPenaltyScale?: number
  /** Robust z-distance at which books begin to be downweighted. */
  outlierZThreshold?: number
  /** Minimum outlier multiplier for a sharp book. */
  minimumSharpOutlierMultiplier?: number
  /** Minimum outlier multiplier for a non-sharp book. */
  minimumRegularOutlierMultiplier?: number
  /** Cap on effective independent books used to reduce dispersion uncertainty. */
  independentBookCap?: number
  /** Irreducible probability uncertainty floor. */
  baseProbabilityUncertainty?: number
  /** Extra uncertainty when one book alone anchors the estimate. */
  singleBookUncertainty?: number
  /** Maximum uncertainty contribution from stale/missing anchor timestamps. */
  freshnessUncertainty?: number
  /** Number of sigmas subtracted from fair probability for conservative EV. */
  uncertaintyZ?: number
  /** Raw EV threshold. `minimumEv` is retained as a backward-compatible alias. */
  minimumRawEv?: number
  minimumEv?: number
  /** Conservative EV threshold before execution buffer. */
  minimumConservativeEv?: number
  /** Conservative EV threshold after execution/model buffer. */
  minimumNetEv?: number
  /** Flat EV haircut for feed delay, movement, rounding, and execution friction. */
  executionBufferEv?: number
  /** Minimum signal-quality score in the 0..100 range. */
  minimumConfidence?: number
  /** Filters lower-probability longshots when a higher raw hit rate is preferred. */
  minimumFairProbability?: number
  /** Fraction of conservative full Kelly. */
  kellyFraction?: number
  /** Hard maximum bankroll fraction per wager. */
  maximumKellyStakeFraction?: number
  /** Event start time as ISO-8601. */
  eventTime?: string
  /** Deterministic evaluation time as ISO-8601; never defaults to system time. */
  asOf?: string
  /** Do not promote signals closer to start than this. */
  minimumMinutesBeforeEvent?: number
  /** Effective book count that earns maximum depth score. */
  targetBookCount?: number
  /** Probability stdev that maps agreement score to zero. */
  agreementStdevCeiling?: number
  /** De-vig-method stdev that maps model-stability score to zero. */
  methodStdevCeiling?: number
}

/** Point-bearing quote used only to detect possible spread/total middles. */
export interface PointOutcomeQuote extends OutcomeQuote {
  point: number
}

/** A geometric middle candidate; this is not an EV estimate. */
export interface MiddleOpportunity {
  market: "spreads" | "totals"
  legs: [PointOutcomeQuote, PointOutcomeQuote]
  width: number
  lowerBound: number
  upperBound: number
  impliedCost: number
  impliedCostPct: number
  marginOutcome?: string
}

interface NormalizedQuote extends OutcomeQuote {
  outcomeKey: string
  bookmakerKey: string
}

interface PreparedBook {
  bookmaker: string
  outcomes: Map<string, NormalizedQuote>
}

interface PreparedMarket {
  outcomeKeys: string[]
  outcomeLabels: Map<string, string>
  books: Map<string, PreparedBook>
  quotes: NormalizedQuote[]
}

export interface EdgeRiskPreset {
  minConsensusBooks: number
  maxAnchorQuoteAgeSeconds: number
  maxTargetQuoteAgeSeconds: number
  uncertaintyZ: number
  minimumRawEv: number
  minimumConservativeEv: number
  minimumNetEv: number
  executionBufferEv: number
  minimumConfidence: number
  minimumFairProbability: number
  kellyFraction: number
  maximumKellyStakeFraction: number
  minimumMinutesBeforeEvent: number
}

interface ResolvedEdgeOptions {
  riskProfile: EdgeRiskProfile
  sharpBookmakers: string[]
  sharpBookmakerSet: Set<string>
  devigMethod: DevigMethod
  uncertaintyDevigMethods: DevigMethod[]
  calibration?: ProbabilityCalibration
  minConsensusBooks: number
  eligibleBookmakers: Set<string> | null
  excludeTargetBookFromAnchor: boolean
  blendSharpWithConsensus: boolean
  bookmakerWeights: Map<string, number>
  sharpBookWeight: number
  maxSoftToSharpWeightRatio: number
  recencyHalfLifeSeconds: number
  maxAnchorQuoteAgeSeconds: number
  maxTargetQuoteAgeSeconds: number
  requireQuoteTimestamps: boolean
  missingTimestampWeight: number
  minimumOverround: number
  maximumOverround: number
  holdPenaltyScale: number
  outlierZThreshold: number
  minimumSharpOutlierMultiplier: number
  minimumRegularOutlierMultiplier: number
  independentBookCap: number
  baseProbabilityUncertainty: number
  singleBookUncertainty: number
  freshnessUncertainty: number
  uncertaintyZ: number
  minimumRawEv: number
  minimumConservativeEv: number
  minimumNetEv: number
  executionBufferEv: number
  minimumConfidence: number
  minimumFairProbability: number
  kellyFraction: number
  maximumKellyStakeFraction: number
  eventTime?: string
  asOf?: string
  minimumMinutesBeforeEvent: number
  targetBookCount: number
  agreementStdevCeiling: number
  methodStdevCeiling: number
}

interface BookFairValue {
  bookmaker: string
  probabilities: number[]
  methodStdevs: number[]
  overround: number
  ageSeconds: number | null
  freshness: number
  isSharp: boolean
  baseWeight: number
  outlierMultiplier: number
  finalWeight: number
  clr: number[]
}

interface InternalAnchor {
  public: FairValueAnchor
  probabilities: number[]
  probabilitySigmas: number[]
  probabilityStdevs: number[]
  methodStdevs: number[]
  effectiveBookCount: number
  sharpWeightShare: number
  weightedFreshness: number
  contributingBookmakers: string[]
}

const RISK_PRESETS: Readonly<Record<EdgeRiskProfile, EdgeRiskPreset>> = {
  conservative: {
    minConsensusBooks: 3,
    maxAnchorQuoteAgeSeconds: 180,
    maxTargetQuoteAgeSeconds: 90,
    uncertaintyZ: 1.28,
    minimumRawEv: 0.025,
    minimumConservativeEv: 0.01,
    minimumNetEv: 0.0025,
    executionBufferEv: 0.0075,
    minimumConfidence: 75,
    minimumFairProbability: 0.5,
    kellyFraction: 0.125,
    maximumKellyStakeFraction: 0.0075,
    minimumMinutesBeforeEvent: 10,
  },
  balanced: {
    minConsensusBooks: 3,
    maxAnchorQuoteAgeSeconds: 240,
    maxTargetQuoteAgeSeconds: 120,
    uncertaintyZ: 1,
    minimumRawEv: 0.02,
    minimumConservativeEv: 0.005,
    minimumNetEv: 0,
    executionBufferEv: 0.005,
    minimumConfidence: 65,
    minimumFairProbability: 0.3,
    kellyFraction: 0.25,
    maximumKellyStakeFraction: 0.01,
    minimumMinutesBeforeEvent: 5,
  },
  aggressive: {
    minConsensusBooks: 2,
    maxAnchorQuoteAgeSeconds: 300,
    maxTargetQuoteAgeSeconds: 180,
    uncertaintyZ: 0.67,
    minimumRawEv: 0.015,
    minimumConservativeEv: 0,
    minimumNetEv: 0,
    executionBufferEv: 0.003,
    minimumConfidence: 55,
    minimumFairProbability: 0.15,
    kellyFraction: 0.25,
    maximumKellyStakeFraction: 0.015,
    minimumMinutesBeforeEvent: 2,
  },
}

/**
 * Converts valid decimal odds to implied probability in the 0..1 range.
 * Returns null for non-finite odds or odds less than or equal to 1.00.
 */
export function decimalToImpliedProbability(decimal: number): number | null {
  return isValidDecimal(decimal) ? 1 / decimal : null
}

/**
 * Removes margin by proportionally normalizing raw implied probabilities.
 * This is simple and stable, but it does not model favorite-longshot bias.
 */
export function devigProportional(decimalOdds: readonly number[]): number[] | null {
  const implied = getRawImpliedProbabilities(decimalOdds)
  if (implied === null) return null
  return normalizeProbabilities(implied)
}

/**
 * Removes margin with the power method: p_i = q_i^k, where k is solved so
 * probabilities sum to one. The method can account for favorite-longshot bias.
 */
export function devigPower(decimalOdds: readonly number[]): number[] | null {
  const implied = getRawImpliedProbabilities(decimalOdds)
  if (implied === null) return null

  const rawTotal = sum(implied)
  if (Math.abs(rawTotal - 1) <= EPSILON) return normalizeProbabilities(implied)

  const objective = (exponent: number): number =>
    implied.reduce((total, value) => total + value ** exponent, 0) - 1

  let lower: number
  let upper: number

  if (rawTotal > 1) {
    lower = 1
    upper = 2
    while (objective(upper) > 0 && upper < 256) upper *= 2
  } else {
    lower = 1e-6
    upper = 1
  }

  const lowerValue = objective(lower)
  const upperValue = objective(upper)
  if (!Number.isFinite(lowerValue) || !Number.isFinite(upperValue)) return null
  if (lowerValue * upperValue > 0) return null

  const exponent = bisectRoot(objective, lower, upper)
  if (exponent === null) return null
  return normalizeProbabilities(implied.map((value) => value ** exponent))
}

/**
 * Removes margin with Shin's insider-trading model. The insider share is solved
 * numerically. Shin is defined here for ordinary overround markets; underround
 * input returns null so callers can fall back safely.
 */
export function devigShin(decimalOdds: readonly number[]): number[] | null {
  const implied = getRawImpliedProbabilities(decimalOdds)
  if (implied === null) return null

  const rawTotal = sum(implied)
  if (Math.abs(rawTotal - 1) <= EPSILON) return normalizeProbabilities(implied)
  if (rawTotal < 1) return null

  const probabilitiesAt = (z: number): number[] | null => {
    const oneMinusZ = 1 - z
    if (oneMinusZ <= EPSILON) return null

    const probabilities = implied.map((value) => {
      const radicand = z * z + (4 * oneMinusZ * value * value) / rawTotal
      if (radicand < 0 || !Number.isFinite(radicand)) return Number.NaN
      return (Math.sqrt(radicand) - z) / (2 * oneMinusZ)
    })

    return probabilities.every(Number.isFinite) ? probabilities : null
  }

  const objective = (z: number): number => {
    const probabilities = probabilitiesAt(z)
    return probabilities === null ? Number.NaN : sum(probabilities) - 1
  }

  const lower = 0
  const upper = 1 - 1e-10
  const lowerValue = objective(lower)
  const upperValue = objective(upper)
  if (!Number.isFinite(lowerValue) || !Number.isFinite(upperValue)) return null
  if (lowerValue * upperValue > 0) return null

  const z = bisectRoot(objective, lower, upper)
  if (z === null) return null
  const probabilities = probabilitiesAt(z)
  return probabilities === null ? null : normalizeProbabilities(probabilities)
}

/**
 * De-vigs a complete 2-way or 3-way market with the requested method.
 * Power is recommended as the default; proportional remains useful as a stable
 * baseline, while Shin is a valuable alternative/model-disagreement signal.
 */
export function devigOdds(
  decimalOdds: readonly number[],
  method: DevigMethod = "power",
): number[] | null {
  switch (method) {
    case "proportional":
      return devigProportional(decimalOdds)
    case "power":
      return devigPower(decimalOdds)
    case "shin":
      return devigShin(decimalOdds)
  }
}

/**
 * Applies a fitted beta or isotonic calibration map to a probability vector,
 * then renormalizes it to the probability simplex. Calibration coefficients
 * must be learned on held-out historical data outside this pure module.
 */
export function applyProbabilityCalibration(
  probabilities: readonly number[],
  calibration: ProbabilityCalibration | undefined,
): number[] | null {
  if (probabilities.length !== 2 && probabilities.length !== 3) return null
  if (probabilities.some((probability) => !isProbability(probability))) return null
  if (calibration === undefined) return normalizeProbabilities(probabilities)

  const calibrated = probabilities.map((probability) => {
    const p = clamp(probability, PROBABILITY_EPSILON, 1 - PROBABILITY_EPSILON)

    if (calibration.kind === "beta") {
      const linear =
        calibration.logProbabilityCoefficient * Math.log(p) +
        calibration.logOneMinusProbabilityCoefficient * Math.log(1 - p) +
        calibration.intercept
      return stableSigmoid(linear)
    }

    return interpolateIsotonic(p, calibration.points)
  })

  return calibrated.every(Number.isFinite) ? normalizeProbabilities(calibrated) : null
}

/**
 * Computes expected return per unit staked as a decimal fraction.
 * Example: 0.05 is +5% EV. Returns null for invalid probability or odds.
 */
export function expectedValue(decimal: number, fairProbability: number): number | null {
  if (!isValidDecimal(decimal) || !isProbability(fairProbability)) return null
  return fairProbability * decimal - 1
}

/**
 * Computes full Kelly and applies a configurable fractional-Kelly multiplier.
 * The returned bankroll fraction is floored at zero. Production callers should
 * pass a conservative probability and separately enforce a hard stake cap.
 */
export function fractionalKellyStake(
  decimal: number,
  fairProbability: number,
  kellyFraction = 0.25,
): number {
  if (!isValidDecimal(decimal) || !isProbability(fairProbability)) return 0
  if (!Number.isFinite(kellyFraction) || kellyFraction <= 0) return 0

  const b = decimal - 1
  const q = 1 - fairProbability
  const fullKelly = (b * fairProbability - q) / b
  return Math.max(0, fullKelly * kellyFraction)
}

/**
 * Returns the documented defaults for a quality/volume profile. A conservative
 * profile raises expected hit probability partly by excluding fair probabilities
 * below 50%; that trade-off can reduce signal volume and may reduce total ROI.
 */
export function getEdgeRiskPreset(profile: EdgeRiskProfile): Readonly<EdgeRiskPreset> {
  return { ...RISK_PRESETS[profile] }
}

/**
 * Builds a global fair-value anchor. This is useful for display and diagnostics.
 * `analyzePositiveEV` goes further and builds a separate leave-one-book-out
 * anchor for every target bookmaker so a book cannot validate its own price.
 */
export function buildFairValueAnchor(
  quotes: readonly OutcomeQuote[],
  options: EdgeOptions = {},
): FairValueAnchor | null {
  const prepared = prepareMarket(quotes)
  if (prepared === null) return null
  const internal = buildAnchorFromPrepared(prepared, resolveOptions(options), null)
  return internal?.public ?? null
}

/**
 * Evaluates every complete target quote using a target-excluded, freshness-aware,
 * robust fair-value anchor. It reports raw EV, uncertainty-adjusted EV, buffered
 * net EV, confidence, rejection reasons, and capped conservative Kelly sizing.
 */
export function analyzePositiveEV(
  quotes: readonly OutcomeQuote[],
  options: EdgeOptions = {},
): EdgeAnalysis | null {
  const prepared = prepareMarket(quotes)
  if (prepared === null) return null

  const resolved = resolveOptions(options)
  const globalAnchor = buildAnchorFromPrepared(prepared, resolved, null)
  if (globalAnchor === null) return null

  const completeBookCount = getCompletePreparedBooks(prepared).length
  const evaluations: EvaluatedQuote[] = []
  const anchorCache = new Map<string, InternalAnchor | null>()

  for (const bookmaker of [...prepared.books.keys()].sort(compareText)) {
    const book = prepared.books.get(bookmaker)
    if (book === undefined || !isCompleteBook(book, prepared.outcomeKeys)) continue

    const excludedBookmaker = resolved.excludeTargetBookFromAnchor ? bookmaker : null
    const cacheKey = excludedBookmaker ?? "__global__"
    let anchor = anchorCache.get(cacheKey)
    if (anchor === undefined) {
      anchor = buildAnchorFromPrepared(prepared, resolved, excludedBookmaker)
      anchorCache.set(cacheKey, anchor)
    }
    if (anchor === null) continue

    for (let outcomeIndex = 0; outcomeIndex < prepared.outcomeKeys.length; outcomeIndex += 1) {
      const outcomeKey = prepared.outcomeKeys[outcomeIndex]
      if (outcomeKey === undefined) continue
      const quote = book.outcomes.get(outcomeKey)
      if (quote === undefined) continue

      const fairProbability = anchor.probabilities[outcomeIndex]
      const probabilitySigma = anchor.probabilitySigmas[outcomeIndex]
      if (fairProbability === undefined || probabilitySigma === undefined) continue

      const evaluated = evaluateQuote(
        quote,
        prepared.outcomeLabels.get(outcomeKey) ?? quote.outcome,
        fairProbability,
        probabilitySigma,
        anchor,
        completeBookCount,
        resolved,
      )
      if (evaluated !== null) evaluations.push(evaluated)
    }
  }

  evaluations.sort(compareEvaluatedQuotes)
  const bestEvaluation = evaluations.find((evaluation) => evaluation.isActionable)
  const best: EdgeOpportunity | null = bestEvaluation
    ? { ...bestEvaluation, booksQuoting: completeBookCount }
    : null

  const representative = bestEvaluation ?? evaluations[0]
  const fallbackConfidence = calculateConfidence(globalAnchor, null, resolved)

  return {
    anchor: globalAnchor.public,
    evaluations,
    best,
    confidence: representative?.confidence ?? fallbackConfidence.score,
    confidenceBreakdown:
      representative?.confidenceBreakdown ?? fallbackConfidence.breakdown,
    booksQuoting: completeBookCount,
  }
}

/** Convenience wrapper returning only the best actionable positive-EV quote. */
export function findBestPositiveEV(
  quotes: readonly OutcomeQuote[],
  options: EdgeOptions = {},
): EdgeOpportunity | null {
  return analyzePositiveEV(quotes, options)?.best ?? null
}

/**
 * Finds the widest two-sided spread middle across different bookmakers.
 * This only identifies geometry. True middle EV requires a calibrated margin
 * distribution, key-number/push probabilities, and both-leg settlement rules.
 */
export function findBestSpreadMiddle(
  quotes: readonly PointOutcomeQuote[],
): MiddleOpportunity | null {
  const valid = normalizePointQuotes(quotes)
  const outcomeKeys = [...new Set(valid.map((quote) => normalizeKey(quote.outcome)))].sort(
    compareText,
  )
  if (outcomeKeys.length !== 2) return null

  const firstKey = outcomeKeys[0]
  const secondKey = outcomeKeys[1]
  if (firstKey === undefined || secondKey === undefined) return null

  const first = valid.filter((quote) => normalizeKey(quote.outcome) === firstKey)
  const second = valid.filter((quote) => normalizeKey(quote.outcome) === secondKey)
  let best: MiddleOpportunity | null = null

  for (const firstLeg of first) {
    for (const secondLeg of second) {
      if (normalizeKey(firstLeg.bookmaker) === normalizeKey(secondLeg.bookmaker)) continue

      const width = firstLeg.point + secondLeg.point
      if (width <= EPSILON) continue

      const candidate: MiddleOpportunity = {
        market: "spreads",
        legs: [firstLeg, secondLeg],
        width,
        lowerBound: -firstLeg.point,
        upperBound: secondLeg.point,
        impliedCost: 1 / firstLeg.decimal + 1 / secondLeg.decimal - 1,
        impliedCostPct: (1 / firstLeg.decimal + 1 / secondLeg.decimal - 1) * 100,
        marginOutcome: `${secondLeg.outcome} minus ${firstLeg.outcome}`,
      }

      if (isBetterMiddle(candidate, best)) best = candidate
    }
  }

  return best
}

/**
 * Finds the widest Over/Under middle across different bookmakers.
 * This is not a profitability estimate; a total-score distribution is required.
 */
export function findBestTotalsMiddle(
  quotes: readonly PointOutcomeQuote[],
): MiddleOpportunity | null {
  const valid = normalizePointQuotes(quotes)
  const overs = valid.filter((quote) => normalizeKey(quote.outcome) === "over")
  const unders = valid.filter((quote) => normalizeKey(quote.outcome) === "under")
  if (overs.length === 0 || unders.length === 0) return null

  let best: MiddleOpportunity | null = null

  for (const over of overs) {
    for (const under of unders) {
      if (normalizeKey(over.bookmaker) === normalizeKey(under.bookmaker)) continue

      const width = under.point - over.point
      if (width <= EPSILON) continue

      const candidate: MiddleOpportunity = {
        market: "totals",
        legs: [over, under],
        width,
        lowerBound: over.point,
        upperBound: under.point,
        impliedCost: 1 / over.decimal + 1 / under.decimal - 1,
        impliedCostPct: (1 / over.decimal + 1 / under.decimal - 1) * 100,
      }

      if (isBetterMiddle(candidate, best)) best = candidate
    }
  }

  return best
}

/** Evaluates a single target quote against its target-specific anchor. */
function evaluateQuote(
  quote: NormalizedQuote,
  outcomeLabel: string,
  fairProbability: number,
  probabilitySigma: number,
  anchor: InternalAnchor,
  completeBookCount: number,
  options: ResolvedEdgeOptions,
): EvaluatedQuote | null {
  const rawEv = expectedValue(quote.decimal, fairProbability)
  if (rawEv === null || fairProbability <= EPSILON) return null

  const conservativeFairProbability = clamp(
    fairProbability - options.uncertaintyZ * probabilitySigma,
    PROBABILITY_EPSILON,
    1 - PROBABILITY_EPSILON,
  )
  const conservativeEv = expectedValue(quote.decimal, conservativeFairProbability)
  if (conservativeEv === null) return null
  const netEv = conservativeEv - options.executionBufferEv

  const targetAgeSeconds = calculateQuoteAgeSeconds(quote.lastUpdate, options.asOf)
  const confidence = calculateConfidence(anchor, targetAgeSeconds, options)
  const rejectionReasons = getRejectionReasons(
    quote.bookmakerKey,
    fairProbability,
    rawEv,
    conservativeEv,
    netEv,
    confidence.score,
    targetAgeSeconds,
    options,
  )

  const fullKellyFraction = fractionalKellyStake(quote.decimal, fairProbability, 1)
  const conservativeFullKellyFraction = fractionalKellyStake(
    quote.decimal,
    conservativeFairProbability,
    1,
  )
  const kellyStakeFraction = Math.min(
    fractionalKellyStake(
      quote.decimal,
      conservativeFairProbability,
      options.kellyFraction,
    ),
    options.maximumKellyStakeFraction,
  )

  const anchorBookmaker = anchor.public.bookmaker

  return {
    outcome: outcomeLabel.trim(),
    bookmaker: quote.bookmakerKey,
    decimal: quote.decimal,
    fairDecimal: 1 / fairProbability,
    fairProbability,
    fairProbabilityPct: fairProbability * 100,
    probabilitySigma,
    conservativeFairProbability,
    conservativeFairProbabilityPct: conservativeFairProbability * 100,
    conservativeFairDecimal: 1 / conservativeFairProbability,
    ev: rawEv,
    evPct: rawEv * 100,
    conservativeEv,
    conservativeEvPct: conservativeEv * 100,
    netEv,
    netEvPct: netEv * 100,
    fullKellyFraction,
    conservativeFullKellyFraction,
    kellyStakeFraction,
    kellyStakePct: kellyStakeFraction * 100,
    confidence: confidence.score,
    confidenceBreakdown: confidence.breakdown,
    anchorSource: anchor.public.source,
    anchorMode: anchor.public.mode,
    ...(anchorBookmaker ? { anchorBookmaker } : {}),
    anchorBookmakers: [...anchor.contributingBookmakers],
    effectiveBookCount: anchor.effectiveBookCount,
    targetQuoteAgeSeconds: targetAgeSeconds,
    isActionable: rejectionReasons.length === 0,
    rejectionReasons,
    ...(quote.lastUpdate ? { lastUpdate: quote.lastUpdate } : {}),
  }
}

/** Determines why an evaluated quote should not be promoted. */
function getRejectionReasons(
  bookmaker: string,
  fairProbability: number,
  rawEv: number,
  conservativeEv: number,
  netEv: number,
  confidence: number,
  targetAgeSeconds: number | null,
  options: ResolvedEdgeOptions,
): EdgeRejectionReason[] {
  const reasons: EdgeRejectionReason[] = []

  if (
    options.eligibleBookmakers !== null &&
    !options.eligibleBookmakers.has(normalizeKey(bookmaker))
  ) {
    reasons.push("book_not_eligible")
  }

  if (targetAgeSeconds === null && options.requireQuoteTimestamps) {
    reasons.push("target_quote_timestamp_missing")
  } else if (
    targetAgeSeconds !== null &&
    targetAgeSeconds > options.maxTargetQuoteAgeSeconds
  ) {
    reasons.push("target_quote_stale")
  }

  const time = calculateTimeToEvent(options.eventTime, options.asOf)
  if (time.hours !== null) {
    if (time.hours < 0) reasons.push("event_started")
    else if (time.hours * 60 < options.minimumMinutesBeforeEvent) {
      reasons.push("too_close_to_event")
    }
  }

  if (fairProbability + EPSILON < options.minimumFairProbability) {
    reasons.push("fair_probability_below_profile")
  }
  if (rawEv + EPSILON < options.minimumRawEv) reasons.push("raw_ev_below_threshold")
  if (conservativeEv + EPSILON < options.minimumConservativeEv) {
    reasons.push("conservative_ev_below_threshold")
  }
  if (netEv + EPSILON < options.minimumNetEv) reasons.push("net_ev_below_threshold")
  if (confidence + EPSILON < options.minimumConfidence) {
    reasons.push("confidence_below_threshold")
  }

  return reasons
}

/** Builds a robust target-excluded fair-value anchor. */
function buildAnchorFromPrepared(
  prepared: PreparedMarket,
  options: ResolvedEdgeOptions,
  excludedBookmaker: string | null,
): InternalAnchor | null {
  let candidates = getCompleteBookFairValues(prepared, options, excludedBookmaker)
  if (candidates.length === 0) return null

  const sharpCandidates = candidates.filter((book) => book.isSharp)
  if (sharpCandidates.length === 0 && candidates.length < options.minConsensusBooks) {
    return null
  }

  if (sharpCandidates.length > 0 && !options.blendSharpWithConsensus) {
    const preferred = options.sharpBookmakers
      .map((bookmaker) => sharpCandidates.find((candidate) => candidate.bookmaker === bookmaker))
      .find((candidate): candidate is BookFairValue => candidate !== undefined)
    if (preferred === undefined) return null
    candidates = [preferred]
  }

  applyRobustOutlierWeights(candidates, options)
  applySharpBlendCap(candidates, options)

  const totalWeight = candidates.reduce((total, book) => total + book.finalWeight, 0)
  if (!Number.isFinite(totalWeight) || totalWeight <= EPSILON) return null

  const outcomeCount = prepared.outcomeKeys.length
  const weightedClr = Array.from({ length: outcomeCount }, () => 0)
  let weightedOverround = 0
  let weightedFreshness = 0
  let sharpWeight = 0

  for (const book of candidates) {
    weightedOverround += book.overround * book.finalWeight
    weightedFreshness += book.freshness * book.finalWeight
    if (book.isSharp) sharpWeight += book.finalWeight

    for (let index = 0; index < outcomeCount; index += 1) {
      weightedClr[index] =
        (weightedClr[index] ?? 0) + (book.clr[index] ?? 0) * book.finalWeight
    }
  }

  const meanClr = weightedClr.map((value) => value / totalWeight)
  const probabilities = softmax(meanClr)
  if (probabilities === null) return null

  const probabilityStdevs = Array.from({ length: outcomeCount }, (_, index) =>
    weightedPopulationStdev(
      candidates.map((book) => book.probabilities[index] ?? Number.NaN),
      candidates.map((book) => book.finalWeight),
      probabilities[index] ?? Number.NaN,
    ),
  )
  if (probabilityStdevs.some((value) => !Number.isFinite(value))) return null

  const methodStdevs = Array.from({ length: outcomeCount }, (_, index) =>
    weightedMean(
      candidates.map((book) => book.methodStdevs[index] ?? 0),
      candidates.map((book) => book.finalWeight),
    ),
  )
  if (methodStdevs.some((value) => !Number.isFinite(value))) return null

  const effectiveBookCount = calculateEffectiveBookCount(
    candidates.map((book) => book.finalWeight),
  )
  const probabilitySigmas = calculateProbabilitySigmas(
    probabilityStdevs,
    methodStdevs,
    effectiveBookCount,
    weightedFreshness / totalWeight,
    candidates.length,
    options,
  )

  const normalizedBookWeights: AnchorBookWeight[] = candidates
    .map((book) => ({
      bookmaker: book.bookmaker,
      normalizedWeight: book.finalWeight / totalWeight,
      isSharp: book.isSharp,
      overround: book.overround,
      freshness: book.freshness,
      ageSeconds: book.ageSeconds,
      outlierMultiplier: book.outlierMultiplier,
    }))
    .sort((left, right) => {
      const weightDifference = right.normalizedWeight - left.normalizedWeight
      if (Math.abs(weightDifference) > EPSILON) return weightDifference
      return compareText(left.bookmaker, right.bookmaker)
    })

  const contributingBookmakers = normalizedBookWeights.map((weight) => weight.bookmaker)
  const preferredSharp = options.sharpBookmakers.find((bookmaker) =>
    candidates.some((candidate) => candidate.bookmaker === bookmaker && candidate.isSharp),
  )
  const hasSharp = sharpWeight > EPSILON
  const mode: FairValueAnchorMode = hasSharp
    ? candidates.length === 1
      ? "single_sharp"
      : "sharp_blend"
    : "consensus"

  const publicAnchor: FairValueAnchor = {
    source: hasSharp ? "sharp" : "consensus",
    mode,
    ...(preferredSharp ? { bookmaker: preferredSharp } : {}),
    ...(excludedBookmaker ? { excludedBookmaker } : {}),
    probabilities: probabilities.map((probability, index) => ({
      outcome: getOutcomeLabel(prepared, index),
      probability,
    })),
    contributingBookmakers,
    overround: weightedOverround / totalWeight,
    effectiveBookCount,
    sharpWeightShare: sharpWeight / totalWeight,
    weightedFreshness: weightedFreshness / totalWeight,
    probabilityStdevs,
    methodStdevs,
    probabilitySigmas,
    bookWeights: normalizedBookWeights,
  }

  return {
    public: publicAnchor,
    probabilities,
    probabilitySigmas,
    probabilityStdevs,
    methodStdevs,
    effectiveBookCount,
    sharpWeightShare: sharpWeight / totalWeight,
    weightedFreshness: weightedFreshness / totalWeight,
    contributingBookmakers,
  }
}

/** Converts every complete, fresh-enough book into a fair-probability vector. */
function getCompleteBookFairValues(
  prepared: PreparedMarket,
  options: ResolvedEdgeOptions,
  excludedBookmaker: string | null,
): BookFairValue[] {
  const books: BookFairValue[] = []

  for (const bookmaker of [...prepared.books.keys()].sort(compareText)) {
    if (excludedBookmaker !== null && bookmaker === excludedBookmaker) continue
    const book = prepared.books.get(bookmaker)
    if (book === undefined) continue
    const fair = getBookFairValue(book, prepared.outcomeKeys, options)
    if (fair !== null) books.push(fair)
  }

  return books
}

/** Converts one complete bookmaker market into fair probabilities and metadata. */
function getBookFairValue(
  book: PreparedBook,
  outcomeKeys: readonly string[],
  options: ResolvedEdgeOptions,
): BookFairValue | null {
  const decimals: number[] = []
  const updateTimes: number[] = []
  let hasMissingTimestamp = false
  let overround = 0

  for (const outcomeKey of outcomeKeys) {
    const quote = book.outcomes.get(outcomeKey)
    if (quote === undefined) return null
    decimals.push(quote.decimal)
    overround += 1 / quote.decimal

    const updateMillis = parseIsoMillis(quote.lastUpdate)
    if (updateMillis === null) hasMissingTimestamp = true
    else updateTimes.push(updateMillis)
  }

  if (
    !Number.isFinite(overround) ||
    overround < options.minimumOverround ||
    overround > options.maximumOverround
  ) {
    return null
  }

  const primary = devigOdds(decimals, options.devigMethod)
  if (primary === null) return null
  const probabilities = applyProbabilityCalibration(primary, options.calibration)
  if (probabilities === null) return null

  const methodVectors: number[][] = []
  for (const method of options.uncertaintyDevigMethods) {
    const raw = devigOdds(decimals, method)
    if (raw === null) continue
    const calibrated = applyProbabilityCalibration(raw, options.calibration)
    if (calibrated !== null) methodVectors.push(calibrated)
  }

  const methodStdevs = probabilities.map((_, index) =>
    populationStdev(
      methodVectors
        .map((vector) => vector[index])
        .filter((value): value is number => value !== undefined && Number.isFinite(value)),
    ),
  )

  const asOfMillis = parseIsoMillis(options.asOf)
  let ageSeconds: number | null = null
  if (!hasMissingTimestamp && updateTimes.length === outcomeKeys.length && asOfMillis !== null) {
    const oldestRequiredSideMillis = Math.min(...updateTimes)
    ageSeconds = Math.max(0, (asOfMillis - oldestRequiredSideMillis) / 1000)
  }

  if (options.requireQuoteTimestamps && ageSeconds === null) return null
  if (ageSeconds !== null && ageSeconds > options.maxAnchorQuoteAgeSeconds) return null

  const freshness =
    ageSeconds === null
      ? options.missingTimestampWeight
      : recencyScore(ageSeconds, options.recencyHalfLifeSeconds)
  const isSharp = options.sharpBookmakerSet.has(book.bookmaker)
  const explicitWeight = options.bookmakerWeights.get(book.bookmaker)
  const reliabilityWeight =
    explicitWeight ?? (isSharp ? options.sharpBookWeight : 1)
  const holdFactor = 1 / (1 + options.holdPenaltyScale * Math.abs(overround - 1))
  const baseWeight = reliabilityWeight * freshness * holdFactor
  if (!Number.isFinite(baseWeight) || baseWeight <= EPSILON) return null

  const clr = toCenteredLogRatio(probabilities)
  if (clr === null) return null

  return {
    bookmaker: book.bookmaker,
    probabilities,
    methodStdevs,
    overround,
    ageSeconds,
    freshness,
    isSharp,
    baseWeight,
    outlierMultiplier: 1,
    finalWeight: baseWeight,
    clr,
  }
}

/** Downweights probability vectors far from the robust median in CLR space. */
function applyRobustOutlierWeights(
  books: BookFairValue[],
  options: ResolvedEdgeOptions,
): void {
  if (books.length < 3) return
  const dimensions = books[0]?.clr.length ?? 0
  if (dimensions === 0) return

  const medians = Array.from({ length: dimensions }, (_, index) =>
    median(books.map((book) => book.clr[index] ?? 0)),
  )
  const scales = Array.from({ length: dimensions }, (_, index) => {
    const deviations = books.map((book) =>
      Math.abs((book.clr[index] ?? 0) - (medians[index] ?? 0)),
    )
    return Math.max(1.4826 * median(deviations), 0.02)
  })

  for (const book of books) {
    const squaredZ = book.clr.reduce((total, value, index) => {
      const center = medians[index] ?? 0
      const scale = scales[index] ?? 0.02
      return total + ((value - center) / scale) ** 2
    }, 0)
    const distance = Math.sqrt(squaredZ / dimensions)
    const rawMultiplier =
      distance <= options.outlierZThreshold
        ? 1
        : (options.outlierZThreshold / distance) ** 2
    const minimum = book.isSharp
      ? options.minimumSharpOutlierMultiplier
      : options.minimumRegularOutlierMultiplier
    book.outlierMultiplier = clamp(rawMultiplier, minimum, 1)
    book.finalWeight = book.baseWeight * book.outlierMultiplier
  }
}

/** Prevents a large soft-book cluster from completely swamping a sharp anchor. */
function applySharpBlendCap(books: BookFairValue[], options: ResolvedEdgeOptions): void {
  const sharpWeight = books
    .filter((book) => book.isSharp)
    .reduce((total, book) => total + book.finalWeight, 0)
  const softBooks = books.filter((book) => !book.isSharp)
  const softWeight = softBooks.reduce((total, book) => total + book.finalWeight, 0)
  if (sharpWeight <= EPSILON || softWeight <= EPSILON) return

  const maximumSoftWeight = sharpWeight * options.maxSoftToSharpWeightRatio
  if (softWeight <= maximumSoftWeight) return
  const scale = maximumSoftWeight / softWeight
  for (const book of softBooks) book.finalWeight *= scale
}

/** Combines observed dispersion, method disagreement, freshness, and sample depth. */
function calculateProbabilitySigmas(
  probabilityStdevs: readonly number[],
  methodStdevs: readonly number[],
  effectiveBookCount: number,
  weightedFreshness: number,
  contributingBookCount: number,
  options: ResolvedEdgeOptions,
): number[] {
  const independentBooks = Math.max(
    1,
    Math.min(effectiveBookCount, options.independentBookCap),
  )
  const singleBookPenalty = contributingBookCount === 1 ? options.singleBookUncertainty : 0
  const freshnessPenalty =
    options.freshnessUncertainty * (1 - clamp(weightedFreshness, 0, 1))

  return probabilityStdevs.map((dispersion, index) => {
    const sampling = dispersion / Math.sqrt(independentBooks)
    const method = methodStdevs[index] ?? 0
    return Math.sqrt(
      options.baseProbabilityUncertainty ** 2 +
        sampling ** 2 +
        method ** 2 +
        singleBookPenalty ** 2 +
        freshnessPenalty ** 2,
    )
  })
}

/** Computes target-specific signal quality. It is a ranking score, not win probability. */
function calculateConfidence(
  anchor: InternalAnchor,
  targetAgeSeconds: number | null,
  options: ResolvedEdgeOptions,
): { score: number; breakdown: ConfidenceBreakdown } {
  const booksScore = clamp(anchor.effectiveBookCount / options.targetBookCount, 0, 1)
  const meanProbabilityStdev = mean(anchor.probabilityStdevs)
  const agreementScore =
    anchor.contributingBookmakers.length < 2
      ? 0.55
      : clamp(
          1 - meanProbabilityStdev / options.agreementStdevCeiling,
          0,
          1,
        )
  const sharpAnchorScore =
    anchor.sharpWeightShare <= EPSILON
      ? 0.45
      : clamp(0.55 + 0.45 * anchor.sharpWeightShare, 0, 1)
  const meanMethodStdev = mean(anchor.methodStdevs)
  const modelStabilityScore = clamp(
    1 - meanMethodStdev / options.methodStdevCeiling,
    0,
    1,
  )
  const targetFreshness =
    targetAgeSeconds === null
      ? options.missingTimestampWeight
      : recencyScore(targetAgeSeconds, options.recencyHalfLifeSeconds)
  const time = calculateTimeToEventScore(options.eventTime, options.asOf)

  const rawScore =
    booksScore * 0.2 +
    agreementScore * 0.2 +
    sharpAnchorScore * 0.18 +
    anchor.weightedFreshness * 0.16 +
    targetFreshness * 0.12 +
    modelStabilityScore * 0.08 +
    time.score * 0.06

  const breakdown: ConfidenceBreakdown = {
    books: booksScore,
    agreement: agreementScore,
    sharpAnchor: sharpAnchorScore,
    timeToEvent: time.score,
    freshness: anchor.weightedFreshness,
    targetFreshness,
    modelStability: modelStabilityScore,
    meanProbabilityStdev,
    meanMethodStdev,
    effectiveBookCount: anchor.effectiveBookCount,
    sharpWeightShare: anchor.sharpWeightShare,
    targetQuoteAgeSeconds: targetAgeSeconds,
    timeToEventHours: time.hours,
  }

  return { score: Math.round(clamp(rawScore, 0, 1) * 100), breakdown }
}

/** Resolves presets and explicit options without consulting ambient state. */
function resolveOptions(options: EdgeOptions): ResolvedEdgeOptions {
  const riskProfile = options.riskProfile ?? "balanced"
  const preset = RISK_PRESETS[riskProfile]
  const sharpBookmakers = uniqueNormalized(options.sharpBookmakers ?? DEFAULT_SHARP_BOOKMAKERS)
  const eligibleBookmakers = options.eligibleBookmakers
    ? new Set(uniqueNormalized(options.eligibleBookmakers))
    : null
  const uncertaintyMethods = uniqueDevigMethods(
    options.uncertaintyDevigMethods ?? DEFAULT_UNCERTAINTY_METHODS,
  )
  const bookmakerWeights = new Map<string, number>()

  if (options.bookmakerWeights) {
    for (const [bookmaker, weight] of Object.entries(options.bookmakerWeights)) {
      const key = normalizeKey(bookmaker)
      if (key && Number.isFinite(weight) && weight > 0) bookmakerWeights.set(key, weight)
    }
  }

  const minimumRawEvSource = options.minimumRawEv ?? options.minimumEv

  return {
    riskProfile,
    sharpBookmakers,
    sharpBookmakerSet: new Set(sharpBookmakers),
    devigMethod: options.devigMethod ?? "power",
    uncertaintyDevigMethods:
      uncertaintyMethods.length > 0 ? uncertaintyMethods : [...DEFAULT_UNCERTAINTY_METHODS],
    ...(options.calibration ? { calibration: options.calibration } : {}),
    minConsensusBooks: boundedInteger(
      options.minConsensusBooks,
      preset.minConsensusBooks,
      2,
      20,
    ),
    eligibleBookmakers,
    excludeTargetBookFromAnchor: options.excludeTargetBookFromAnchor ?? true,
    blendSharpWithConsensus: options.blendSharpWithConsensus ?? true,
    bookmakerWeights,
    sharpBookWeight: positiveFinite(options.sharpBookWeight, 3),
    maxSoftToSharpWeightRatio: positiveFinite(options.maxSoftToSharpWeightRatio, 1.5),
    recencyHalfLifeSeconds: positiveFinite(options.recencyHalfLifeSeconds, 300),
    maxAnchorQuoteAgeSeconds: nonNegativeFinite(
      options.maxAnchorQuoteAgeSeconds,
      preset.maxAnchorQuoteAgeSeconds,
    ),
    maxTargetQuoteAgeSeconds: nonNegativeFinite(
      options.maxTargetQuoteAgeSeconds,
      preset.maxTargetQuoteAgeSeconds,
    ),
    requireQuoteTimestamps: options.requireQuoteTimestamps ?? false,
    missingTimestampWeight: clamp(
      finiteOr(options.missingTimestampWeight, 0.5),
      0,
      1,
    ),
    minimumOverround: clamp(finiteOr(options.minimumOverround, 0.85), 0.5, 2),
    maximumOverround: clamp(finiteOr(options.maximumOverround, 1.35), 0.5, 2),
    holdPenaltyScale: nonNegativeFinite(options.holdPenaltyScale, 4),
    outlierZThreshold: positiveFinite(options.outlierZThreshold, 3),
    minimumSharpOutlierMultiplier: clamp(
      finiteOr(options.minimumSharpOutlierMultiplier, 0.5),
      0,
      1,
    ),
    minimumRegularOutlierMultiplier: clamp(
      finiteOr(options.minimumRegularOutlierMultiplier, 0.1),
      0,
      1,
    ),
    independentBookCap: positiveFinite(options.independentBookCap, 3),
    baseProbabilityUncertainty: nonNegativeFinite(
      options.baseProbabilityUncertainty,
      0.006,
    ),
    singleBookUncertainty: nonNegativeFinite(options.singleBookUncertainty, 0.01),
    freshnessUncertainty: nonNegativeFinite(options.freshnessUncertainty, 0.01),
    uncertaintyZ: nonNegativeFinite(options.uncertaintyZ, preset.uncertaintyZ),
    minimumRawEv: nonNegativeFinite(minimumRawEvSource, preset.minimumRawEv),
    minimumConservativeEv: finiteOr(
      options.minimumConservativeEv,
      preset.minimumConservativeEv,
    ),
    minimumNetEv: finiteOr(options.minimumNetEv, preset.minimumNetEv),
    executionBufferEv: nonNegativeFinite(
      options.executionBufferEv,
      preset.executionBufferEv,
    ),
    minimumConfidence: clamp(
      finiteOr(options.minimumConfidence, preset.minimumConfidence),
      0,
      100,
    ),
    minimumFairProbability: clamp(
      finiteOr(options.minimumFairProbability, preset.minimumFairProbability),
      0,
      1,
    ),
    kellyFraction: nonNegativeFinite(options.kellyFraction, preset.kellyFraction),
    maximumKellyStakeFraction: nonNegativeFinite(
      options.maximumKellyStakeFraction,
      preset.maximumKellyStakeFraction,
    ),
    ...(options.eventTime ? { eventTime: options.eventTime } : {}),
    ...(options.asOf ? { asOf: options.asOf } : {}),
    minimumMinutesBeforeEvent: nonNegativeFinite(
      options.minimumMinutesBeforeEvent,
      preset.minimumMinutesBeforeEvent,
    ),
    targetBookCount: positiveFinite(options.targetBookCount, 4),
    agreementStdevCeiling: positiveFinite(options.agreementStdevCeiling, 0.06),
    methodStdevCeiling: positiveFinite(options.methodStdevCeiling, 0.02),
  }
}

/** Returns raw implied probabilities for a valid 2-way or 3-way market. */
function getRawImpliedProbabilities(decimalOdds: readonly number[]): number[] | null {
  if (decimalOdds.length !== 2 && decimalOdds.length !== 3) return null
  const implied = decimalOdds.map(decimalToImpliedProbability)
  if (implied.some((value) => value === null)) return null
  return implied as number[]
}

/** Bisection for a finite continuous scalar function whose endpoints bracket zero. */
function bisectRoot(
  fn: (value: number) => number,
  lower: number,
  upper: number,
): number | null {
  let low = lower
  let high = upper
  let lowValue = fn(low)
  let highValue = fn(high)
  if (!Number.isFinite(lowValue) || !Number.isFinite(highValue)) return null
  if (Math.abs(lowValue) <= EPSILON) return low
  if (Math.abs(highValue) <= EPSILON) return high
  if (lowValue * highValue > 0) return null

  for (let iteration = 0; iteration < 120; iteration += 1) {
    const middle = (low + high) / 2
    const middleValue = fn(middle)
    if (!Number.isFinite(middleValue)) return null
    if (Math.abs(middleValue) <= 1e-14 || Math.abs(high - low) <= 1e-14) return middle

    if (lowValue * middleValue <= 0) {
      high = middle
      highValue = middleValue
    } else {
      low = middle
      lowValue = middleValue
    }
  }

  return (low + high) / 2
}

/** Cleans, normalizes, deduplicates, and validates one event's 2-way/3-way quotes. */
function prepareMarket(quotes: readonly OutcomeQuote[]): PreparedMarket | null {
  const outcomeLabels = new Map<string, string>()
  const books = new Map<string, PreparedBook>()

  for (const quote of quotes) {
    if (!isValidDecimal(quote.decimal)) continue
    if (typeof quote.outcome !== "string" || typeof quote.bookmaker !== "string") continue

    const outcome = quote.outcome.trim()
    const bookmakerKey = normalizeKey(quote.bookmaker)
    const outcomeKey = normalizeKey(outcome)
    if (!bookmakerKey || !outcomeKey) continue

    const previousLabel = outcomeLabels.get(outcomeKey)
    if (previousLabel === undefined || compareText(outcome, previousLabel) < 0) {
      outcomeLabels.set(outcomeKey, outcome)
    }

    let book = books.get(bookmakerKey)
    if (book === undefined) {
      book = { bookmaker: bookmakerKey, outcomes: new Map<string, NormalizedQuote>() }
      books.set(bookmakerKey, book)
    }

    const normalized: NormalizedQuote = {
      ...quote,
      outcome,
      bookmaker: bookmakerKey,
      outcomeKey,
      bookmakerKey,
    }
    const existing = book.outcomes.get(outcomeKey)
    if (existing === undefined || shouldReplaceQuote(normalized, existing)) {
      book.outcomes.set(outcomeKey, normalized)
    }
  }

  const outcomeKeys = [...outcomeLabels.keys()].sort(compareText)
  if (outcomeKeys.length !== 2 && outcomeKeys.length !== 3) return null

  const normalizedQuotes: NormalizedQuote[] = []
  for (const bookmaker of [...books.keys()].sort(compareText)) {
    const book = books.get(bookmaker)
    if (book === undefined || !isCompleteBook(book, outcomeKeys)) continue
    for (const outcomeKey of outcomeKeys) {
      const quote = book.outcomes.get(outcomeKey)
      if (quote !== undefined) normalizedQuotes.push(quote)
    }
  }

  if (normalizedQuotes.length === 0) return null
  return { outcomeKeys, outcomeLabels, books, quotes: normalizedQuotes }
}

/** Returns complete books from a prepared market. */
function getCompletePreparedBooks(prepared: PreparedMarket): PreparedBook[] {
  return [...prepared.books.values()].filter((book) =>
    isCompleteBook(book, prepared.outcomeKeys),
  )
}

/** Checks whether a book quotes every required market outcome. */
function isCompleteBook(book: PreparedBook, outcomeKeys: readonly string[]): boolean {
  return outcomeKeys.every((outcomeKey) => book.outcomes.has(outcomeKey))
}

/** Chooses a deterministic winner when duplicate book/outcome quotes are present. */
function shouldReplaceQuote(next: NormalizedQuote, current: NormalizedQuote): boolean {
  const nextTime = parseIsoMillis(next.lastUpdate)
  const currentTime = parseIsoMillis(current.lastUpdate)

  if (nextTime !== null && currentTime !== null && nextTime !== currentTime) {
    return nextTime > currentTime
  }
  if (nextTime !== null && currentTime === null) return true
  if (nextTime === null && currentTime !== null) return false
  if (Math.abs(next.decimal - current.decimal) > EPSILON) return next.decimal > current.decimal
  return false
}

/** Calculates quote age relative to deterministic asOf time. */
function calculateQuoteAgeSeconds(
  lastUpdate: string | undefined,
  asOf: string | undefined,
): number | null {
  const updateMillis = parseIsoMillis(lastUpdate)
  const asOfMillis = parseIsoMillis(asOf)
  if (updateMillis === null || asOfMillis === null) return null
  return Math.max(0, (asOfMillis - updateMillis) / 1000)
}

/** Time-to-event values without reading the system clock. */
function calculateTimeToEvent(
  eventTime: string | undefined,
  asOf: string | undefined,
): { hours: number | null } {
  const eventMillis = parseIsoMillis(eventTime)
  const asOfMillis = parseIsoMillis(asOf)
  if (eventMillis === null || asOfMillis === null) return { hours: null }
  return { hours: (eventMillis - asOfMillis) / 3_600_000 }
}

/** Maps time-to-event into a heuristic signal-quality component. */
function calculateTimeToEventScore(
  eventTime: string | undefined,
  asOf: string | undefined,
): { score: number; hours: number | null } {
  const { hours } = calculateTimeToEvent(eventTime, asOf)
  if (hours === null) return { score: 0.5, hours: null }
  if (hours < 0) return { score: 0, hours }
  if (hours < 0.0833) return { score: 0.4, hours }
  if (hours < 0.25) return { score: 0.75, hours }
  if (hours <= 6) return { score: 1, hours }
  if (hours <= 24) return { score: 0.9, hours }
  if (hours <= 72) return { score: 0.75, hours }
  if (hours <= 168) return { score: 0.6, hours }
  return { score: 0.4, hours }
}

/** Exponential recency score with a configurable half-life. */
function recencyScore(ageSeconds: number, halfLifeSeconds: number): number {
  if (!Number.isFinite(ageSeconds) || ageSeconds < 0) return 0
  return 2 ** (-ageSeconds / halfLifeSeconds)
}

/** Converts a probability vector to centered log-ratio coordinates. */
function toCenteredLogRatio(probabilities: readonly number[]): number[] | null {
  if (probabilities.some((probability) => probability <= 0 || !Number.isFinite(probability))) {
    return null
  }
  const logs = probabilities.map((probability) => Math.log(probability))
  const logMean = mean(logs)
  return logs.map((value) => value - logMean)
}

/** Converts arbitrary log coordinates back to a probability simplex. */
function softmax(values: readonly number[]): number[] | null {
  if (values.length !== 2 && values.length !== 3) return null
  if (values.some((value) => !Number.isFinite(value))) return null
  const maximum = Math.max(...values)
  const exponentials = values.map((value) => Math.exp(value - maximum))
  return normalizeProbabilities(exponentials)
}

/** Normalizes positive finite values so they sum to one. */
function normalizeProbabilities(values: readonly number[]): number[] | null {
  if (values.length !== 2 && values.length !== 3) return null
  if (values.some((value) => !Number.isFinite(value) || value < 0)) return null
  const total = sum(values)
  if (!Number.isFinite(total) || total <= EPSILON) return null
  const normalized = values.map((value) => value / total)
  return normalized.every(isProbability) ? normalized : null
}

/** Piecewise-linear interpolation for an externally fitted monotone calibration map. */
function interpolateIsotonic(
  probability: number,
  points: readonly { predicted: number; calibrated: number }[],
): number {
  const valid = points
    .filter(
      (point) =>
        Number.isFinite(point.predicted) &&
        Number.isFinite(point.calibrated) &&
        point.predicted >= 0 &&
        point.predicted <= 1,
    )
    .map((point) => ({
      predicted: clamp(point.predicted, 0, 1),
      calibrated: clamp(point.calibrated, 0, 1),
    }))
    .sort((left, right) => left.predicted - right.predicted)

  if (valid.length === 0) return probability
  const first = valid[0]
  const last = valid[valid.length - 1]
  if (first === undefined || last === undefined) return probability
  if (probability <= first.predicted) return first.calibrated
  if (probability >= last.predicted) return last.calibrated

  for (let index = 1; index < valid.length; index += 1) {
    const right = valid[index]
    const left = valid[index - 1]
    if (left === undefined || right === undefined) continue
    if (probability > right.predicted) continue
    const width = right.predicted - left.predicted
    if (width <= EPSILON) return right.calibrated
    const ratio = (probability - left.predicted) / width
    return left.calibrated + ratio * (right.calibrated - left.calibrated)
  }

  return probability
}

/** Numerically stable logistic function. */
function stableSigmoid(value: number): number {
  if (value >= 0) return 1 / (1 + Math.exp(-value))
  const exponential = Math.exp(value)
  return exponential / (1 + exponential)
}

/** Weighted population standard deviation around a supplied center. */
function weightedPopulationStdev(
  values: readonly number[],
  weights: readonly number[],
  center: number,
): number {
  if (values.length === 0 || values.length !== weights.length || !Number.isFinite(center)) {
    return Number.NaN
  }
  const totalWeight = sum(weights)
  if (totalWeight <= EPSILON) return Number.NaN
  const variance = values.reduce((total, value, index) => {
    const weight = weights[index] ?? 0
    return total + weight * (value - center) ** 2
  }, 0) / totalWeight
  return Math.sqrt(Math.max(0, variance))
}

/** Kish-style effective sample size for nonnegative weights. */
function calculateEffectiveBookCount(weights: readonly number[]): number {
  const total = sum(weights)
  const squared = weights.reduce((result, weight) => result + weight * weight, 0)
  if (total <= EPSILON || squared <= EPSILON) return 0
  return (total * total) / squared
}

/** Weighted arithmetic mean. */
function weightedMean(values: readonly number[], weights: readonly number[]): number {
  if (values.length === 0 || values.length !== weights.length) return Number.NaN
  const totalWeight = sum(weights)
  if (totalWeight <= EPSILON) return Number.NaN
  return values.reduce((total, value, index) => total + value * (weights[index] ?? 0), 0) /
    totalWeight
}

/** Population standard deviation; one observation has zero observed dispersion. */
function populationStdev(values: readonly number[]): number {
  if (values.length <= 1) return 0
  const center = mean(values)
  const variance = values.reduce((total, value) => total + (value - center) ** 2, 0) /
    values.length
  return Math.sqrt(Math.max(0, variance))
}

/** Median for a finite numeric array. */
function median(values: readonly number[]): number {
  if (values.length === 0) return 0
  const ordered = [...values].sort((left, right) => left - right)
  const middle = Math.floor(ordered.length / 2)
  if (ordered.length % 2 === 1) return ordered[middle] ?? 0
  return ((ordered[middle - 1] ?? 0) + (ordered[middle] ?? 0)) / 2
}

/** Arithmetic mean; empty arrays return zero for deterministic diagnostics. */
function mean(values: readonly number[]): number {
  return values.length === 0 ? 0 : sum(values) / values.length
}

/** Numeric sum. */
function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0)
}

/** Produces a deterministic outcome label for an anchor index. */
function getOutcomeLabel(prepared: PreparedMarket, index: number): string {
  const key = prepared.outcomeKeys[index] ?? ""
  return prepared.outcomeLabels.get(key) ?? key
}

/** Sorts actionable/high-net-EV quotes first with deterministic tie breakers. */
function compareEvaluatedQuotes(left: EvaluatedQuote, right: EvaluatedQuote): number {
  if (left.isActionable !== right.isActionable) return left.isActionable ? -1 : 1
  const netDifference = right.netEv - left.netEv
  if (Math.abs(netDifference) > EPSILON) return netDifference
  const confidenceDifference = right.confidence - left.confidence
  if (Math.abs(confidenceDifference) > EPSILON) return confidenceDifference
  const rawDifference = right.ev - left.ev
  if (Math.abs(rawDifference) > EPSILON) return rawDifference
  const decimalDifference = right.decimal - left.decimal
  if (Math.abs(decimalDifference) > EPSILON) return decimalDifference
  const bookmakerDifference = compareText(left.bookmaker, right.bookmaker)
  if (bookmakerDifference !== 0) return bookmakerDifference
  return compareText(left.outcome, right.outcome)
}

/** Filters and deterministically sorts point-bearing quotes. */
function normalizePointQuotes(quotes: readonly PointOutcomeQuote[]): PointOutcomeQuote[] {
  return quotes
    .filter(
      (quote) =>
        typeof quote.outcome === "string" &&
        typeof quote.bookmaker === "string" &&
        normalizeKey(quote.outcome) !== "" &&
        normalizeKey(quote.bookmaker) !== "" &&
        isValidDecimal(quote.decimal) &&
        Number.isFinite(quote.point),
    )
    .map((quote) => ({
      ...quote,
      outcome: quote.outcome.trim(),
      bookmaker: normalizeKey(quote.bookmaker),
    }))
    .sort((left, right) => {
      const outcomeDifference = compareText(normalizeKey(left.outcome), normalizeKey(right.outcome))
      if (outcomeDifference !== 0) return outcomeDifference
      const bookmakerDifference = compareText(left.bookmaker, right.bookmaker)
      if (bookmakerDifference !== 0) return bookmakerDifference
      if (left.point !== right.point) return left.point - right.point
      return right.decimal - left.decimal
    })
}

/** Ranks middle candidates by width, then lower two-leg implied cost. */
function isBetterMiddle(
  candidate: MiddleOpportunity,
  current: MiddleOpportunity | null,
): boolean {
  if (current === null) return true
  if (Math.abs(candidate.width - current.width) > EPSILON) {
    return candidate.width > current.width
  }
  if (Math.abs(candidate.impliedCost - current.impliedCost) > EPSILON) {
    return candidate.impliedCost < current.impliedCost
  }
  const candidateKey = `${candidate.legs[0].bookmaker}|${candidate.legs[1].bookmaker}`
  const currentKey = `${current.legs[0].bookmaker}|${current.legs[1].bookmaker}`
  return compareText(candidateKey, currentKey) < 0
}

/** Returns true for finite decimal odds strictly greater than 1.00. */
function isValidDecimal(decimal: number): boolean {
  return Number.isFinite(decimal) && decimal > 1
}

/** Returns true for finite probabilities in the closed 0..1 interval. */
function isProbability(probability: number): boolean {
  return Number.isFinite(probability) && probability >= 0 && probability <= 1
}

/** Normalizes bookmaker/outcome identifiers. */
function normalizeKey(value: string): string {
  return value.trim().toLowerCase()
}

/** Locale-independent deterministic text comparison. */
function compareText(left: string, right: string): number {
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

/** Parses ISO-like dates into epoch milliseconds. */
function parseIsoMillis(value: string | undefined): number | null {
  if (!value) return null
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

/** Clamps a number to an inclusive range. */
function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

/** Uses fallback for undefined/non-finite values. */
function finiteOr(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) ? value : fallback
}

/** Uses fallback unless a value is finite and nonnegative. */
function nonNegativeFinite(value: number | undefined, fallback: number): number {
  const resolved = finiteOr(value, fallback)
  return resolved >= 0 ? resolved : fallback
}

/** Uses fallback unless a value is finite and strictly positive. */
function positiveFinite(value: number | undefined, fallback: number): number {
  const resolved = finiteOr(value, fallback)
  return resolved > 0 ? resolved : fallback
}

/** Resolves and bounds an integer. */
function boundedInteger(
  value: number | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const resolved = value !== undefined && Number.isFinite(value) ? Math.floor(value) : fallback
  return Math.floor(clamp(resolved, minimum, maximum))
}

/** Deduplicates normalized non-empty strings. */
function uniqueNormalized(values: readonly string[]): string[] {
  return [...new Set(values.map(normalizeKey).filter(Boolean))]
}

/** Deduplicates valid de-vig methods. */
function uniqueDevigMethods(values: readonly DevigMethod[]): DevigMethod[] {
  return [...new Set(values.filter((value) =>
    value === "proportional" || value === "power" || value === "shin",
  ))]
}
