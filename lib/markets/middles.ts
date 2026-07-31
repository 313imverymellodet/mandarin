import type { OutcomeQuote } from "./arbitrage"
import { isAsianQuarterLine } from "./settlement-math"

const EPSILON = 1e-9
const PROBABILITY_EPSILON = 1e-7
const SQRT_TWO = Math.sqrt(2)

export type MiddleMarket = "spreads" | "totals"

export interface PointOutcomeQuote extends OutcomeQuote {
  market: MiddleMarket
  point: number
}

export interface MiddleModelPrior {
  /** Standard deviation of score margin for spread markets. */
  spreadSigma?: number
  /** Standard deviation of combined score for total markets. */
  totalSigma?: number
  /** Scenario-grid variation around the central sigma. Default 20%. */
  sigmaUncertaintyFraction?: number
  /** Minimum uncertainty applied to the fitted mean. */
  meanUncertaintyFloor?: number
  /** Lower market-fit sigma bound as a multiple of the sport prior. */
  sigmaLowerMultiplier?: number
  /** Upper market-fit sigma bound as a multiple of the sport prior. */
  sigmaUpperMultiplier?: number
  /** Regularization strength pulling fitted sigma toward the sport prior. */
  sigmaRegularization?: number
}

export interface MiddleOptions {
  sportKey: string
  homeTeam?: string
  awayTeam?: string
  sharpBookmakers?: readonly string[]
  eligibleBookmakers?: readonly string[]
  /** Optional reliability multipliers, keyed by lowercase book key. */
  bookmakerWeights?: Readonly<Record<string, number>>
  /** Optional dependency buckets for books sharing a feed or trading model. */
  bookmakerCorrelationGroups?: Readonly<Record<string, string>>
  /** Maximum combined soft-book weight relative to sharp weight. */
  maxSoftToSharpWeightRatio?: number
  /** Maximum weight of one correlation group relative to its strongest book. */
  correlationGroupWeightCap?: number
  asOf: string
  eventTime?: string
  maxQuoteAgeMs?: number
  maxTargetQuoteSkewMs?: number
  /** Maximum timing difference between target legs and the fitted anchor. */
  maxTargetAnchorSkewMs?: number
  maxFutureQuoteSkewMs?: number
  requireQuoteTimestamps?: boolean
  minCompleteBooks?: number
  /** Minimum distinct anchor thresholds needed for actionable market fitting. */
  minDistinctAnchorPoints?: number
  fitSigmaFromMarket?: boolean
  minimumFitQuality?: number
  minimumConfidence?: number
  minimumConservativeEv?: number
  minimumMiddleProbability?: number
  maximumOutsideLoss?: number
  executionBuffer?: number
  /** Additional EV haircut as target quotes approach the age limit. */
  ageExecutionBuffer?: number
  /** Additional EV haircut as target/anchor timing diverges. */
  skewExecutionBuffer?: number
  /** Fail-closed production gate. Defaults false until held-out calibration passes. */
  allowActionable?: boolean
  /** Version/tag for the held-out sport/market calibration that enabled actionability. */
  calibrationId?: string
  minMinutesBeforeEvent?: number
  maxCandidates?: number
  maxJackknifeBooks?: number
  prior?: MiddleModelPrior
}

export interface MiddleLeg {
  quote: PointOutcomeQuote
  stakeFraction: number
}

export interface MiddleProbabilityBreakdown {
  bothWin: number
  legAOnly: number
  legBOnly: number
  pushMix: number
  bothLoss: number
}

export interface MiddleDistributionEstimate {
  mean: number
  sigma: number
  priorSigma: number
  fitMethod: "prior_sigma" | "market_ladder"
  fitRmse: number
  fitQuality: number
  meanUncertainty: number
  effectiveBookCount: number
  completeBookCount: number
  correlationGroupCount: number
  observationCount: number
  distinctPointCount: number
  sharpAnchorPresent: boolean
  confidence: number
  averageQuoteAgeSeconds: number | null
  sigmaUncertaintyFraction: number
  methodDisagreement: number
  jackknifeMeanShift: number
  jackknifeSigmaFraction: number
  anchorBookmakers: string[]
}

export interface MiddleOpportunity {
  market: MiddleMarket
  status: "actionable" | "candidate"
  modelVersion: "market-ladder-discrete-normal-v3"
  calibrationId?: string
  referenceOutcome?: string
  legs: [MiddleLeg, MiddleLeg]
  lowerBound: number
  upperBound: number
  landingValues: number[]
  windowLabel: string
  bothWinProfit: number
  outsideWindowProfit: number
  lowerPushProfit: number | null
  upperPushProfit: number | null
  /** Approximate no-push middle probability required to break even. */
  breakEvenMiddleProbability: number
  estimatedMiddleProbability: number
  conservativeMiddleProbability: number
  probabilityBreakdown: MiddleProbabilityBreakdown
  rawEv: number
  conservativeEv: number
  executionBufferApplied: number
  confidence: number
  distribution: MiddleDistributionEstimate
  keyNumbersInWindow: number[]
  quoteAgeSeconds: number | null
  /** Timing difference between the two target legs. */
  targetQuoteSkewSeconds: number | null
  /** Timing difference between the target pair and fitted anchor. */
  targetAnchorSkewSeconds: number | null
  excludedBookmakers: [string, string]
  rejectionReasons: string[]
}

export interface MiddleStakePlanLeg {
  quote: PointOutcomeQuote
  stake: number
  stakeFraction: number
  idealStakeFraction: number
}

export interface MiddleStakePlan {
  totalStake: number
  legs: [MiddleStakePlanLeg, MiddleStakePlanLeg]
  bothWinProfit: number
  legAOnlyProfit: number
  legBOnlyProfit: number
  worstOutsideProfit: number
  payoutImbalance: number
  currencyPrecision: number
}

interface MarketObservation {
  bookmaker: string
  threshold: number
  fairConditionalWinProbability: number
  methodStdev: number
  overround: number
  weight: number
  quoteAgeSeconds: number | null
  isSharp: boolean
}

interface FittedDistribution extends MiddleDistributionEstimate {
  jackknifeModels: Array<{ mean: number; sigma: number }>
}

interface SettlementMetrics {
  ev: number
  middleProbability: number
  breakdown: MiddleProbabilityBreakdown
}

interface ResolvedOptions {
  sportKey: string
  homeTeam?: string
  awayTeam?: string
  sharpBookmakers: Set<string>
  eligibleBookmakers: Set<string> | null
  bookmakerWeights: Map<string, number>
  bookmakerCorrelationGroups: Map<string, string>
  maxSoftToSharpWeightRatio: number
  correlationGroupWeightCap: number
  asOfMs: number
  eventTimeMs: number | null
  maxQuoteAgeMs: number
  maxTargetQuoteSkewMs: number
  maxTargetAnchorSkewMs: number
  maxFutureQuoteSkewMs: number
  requireQuoteTimestamps: boolean
  minCompleteBooks: number
  minDistinctAnchorPoints: number
  fitSigmaFromMarket: boolean
  minimumFitQuality: number
  minimumConfidence: number
  minimumConservativeEv: number
  minimumMiddleProbability: number
  maximumOutsideLoss: number
  executionBuffer: number
  ageExecutionBuffer: number
  skewExecutionBuffer: number
  allowActionable: boolean
  calibrationId: string | null
  minMinutesBeforeEvent: number
  maxCandidates: number
  maxJackknifeBooks: number
  prior: Required<
    Pick<
      MiddleModelPrior,
      | "sigmaUncertaintyFraction"
      | "meanUncertaintyFloor"
      | "sigmaLowerMultiplier"
      | "sigmaUpperMultiplier"
      | "sigmaRegularization"
    >
  > & MiddleModelPrior
}

interface PairContext {
  distributionCache: Map<string, FittedDistribution | null>
}

/**
 * Find and model spread or total middles. Target books are excluded from the
 * fitted anchor, all matched alternate lines are used, quote skew is gated, and
 * totals use a non-negative truncated discrete distribution.
 */
export function findMiddleOpportunities(
  quotes: readonly PointOutcomeQuote[],
  options: MiddleOptions,
): MiddleOpportunity[] {
  const resolved = resolveOptions(options)
  if (!resolved) return []

  const market = commonMarket(quotes)
  if (!market) return []

  const validQuotes = sanitizeQuotes(quotes, resolved)
  if (validQuotes.length < 4) return []

  const referenceOutcome = market === "spreads"
    ? resolveReferenceOutcome(validQuotes, resolved)
    : "Over"
  if (!referenceOutcome) return []

  const targets = resolved.eligibleBookmakers
    ? validQuotes.filter((quote) => resolved.eligibleBookmakers?.has(normalizeBook(quote.bookmaker)))
    : validQuotes
  const context: PairContext = { distributionCache: new Map() }

  const candidates = market === "totals"
    ? buildTotalsCandidates(targets, validQuotes, resolved, context)
    : buildSpreadCandidates(targets, validQuotes, referenceOutcome, resolved, context)

  return candidates
    .sort(compareMiddleOpportunities)
    .slice(0, resolved.maxCandidates)
}

/** Return the highest-ranked middle, or null when no valid pair exists. */
export function findBestMiddle(
  quotes: readonly PointOutcomeQuote[],
  options: MiddleOptions,
): MiddleOpportunity | null {
  return findMiddleOpportunities(quotes, { ...options, maxCandidates: 1 })[0] ?? null
}

/**
 * Balanced two-leg stake fractions. They equalize the net result when exactly
 * one leg wins, minimizing the maximum outside-window loss.
 */
export function balancedMiddleStakeFractions(
  decimalA: number,
  decimalB: number,
): [number, number] | null {
  if (!isValidDecimal(decimalA) || !isValidDecimal(decimalB)) return null
  const denominator = decimalA + decimalB
  if (!Number.isFinite(denominator) || denominator <= 0) return null
  return [decimalB / denominator, decimalA / denominator]
}

/**
 * Build a currency-rounded middle plan that maximizes the worse of the two
 * one-leg-win results. Payouts are rounded down conservatively.
 */
export function buildMiddleStakePlan(
  quoteA: PointOutcomeQuote,
  quoteB: PointOutcomeQuote,
  totalStake: number,
  currencyPrecision = 2,
): MiddleStakePlan | null {
  if (!isValidDecimal(quoteA.decimal) || !isValidDecimal(quoteB.decimal)) return null
  if (!Number.isFinite(totalStake) || totalStake <= 0) return null
  if (!Number.isInteger(currencyPrecision) || currencyPrecision < 0 || currencyPrecision > 6) {
    return null
  }

  const fractions = balancedMiddleStakeFractions(quoteA.decimal, quoteB.decimal)
  if (!fractions) return null
  const scale = 10 ** currencyPrecision
  const totalUnits = Math.round(totalStake * scale)
  if (!Number.isSafeInteger(totalUnits) || totalUnits < 2) return null

  const idealA = fractions[0] * totalUnits
  const center = Math.round(idealA)
  const radius = Math.min(totalUnits, 32)
  let bestA = Math.max(1, Math.min(totalUnits - 1, center))
  let bestScore: readonly number[] | null = null

  for (let unitsA = Math.max(1, center - radius); unitsA <= Math.min(totalUnits - 1, center + radius); unitsA += 1) {
    const unitsB = totalUnits - unitsA
    const grossA = Math.floor((unitsA * quoteA.decimal) + EPSILON) / scale
    const grossB = Math.floor((unitsB * quoteB.decimal) + EPSILON) / scale
    const oneA = grossA - totalUnits / scale
    const oneB = grossB - totalUnits / scale
    const score = [Math.min(oneA, oneB), -Math.abs(oneA - oneB), grossA + grossB]
    if (bestScore === null || compareScore(score, bestScore) > 0) {
      bestScore = score
      bestA = unitsA
    }
  }

  const unitsB = totalUnits - bestA
  const stakeA = bestA / scale
  const stakeB = unitsB / scale
  const roundedTotal = totalUnits / scale
  const grossA = Math.floor((bestA * quoteA.decimal) + EPSILON) / scale
  const grossB = Math.floor((unitsB * quoteB.decimal) + EPSILON) / scale
  const legAOnlyProfit = grossA - roundedTotal
  const legBOnlyProfit = grossB - roundedTotal

  return {
    totalStake: roundedTotal,
    legs: [
      { quote: quoteA, stake: stakeA, stakeFraction: stakeA / roundedTotal, idealStakeFraction: fractions[0] },
      { quote: quoteB, stake: stakeB, stakeFraction: stakeB / roundedTotal, idealStakeFraction: fractions[1] },
    ],
    bothWinProfit: grossA + grossB - roundedTotal,
    legAOnlyProfit,
    legBOnlyProfit,
    worstOutsideProfit: Math.min(legAOnlyProfit, legBOnlyProfit),
    payoutImbalance: Math.abs(legAOnlyProfit - legBOnlyProfit),
    currencyPrecision,
  }
}

/** Standard normal cumulative distribution function. */
export function normalCdf(value: number): number {
  if (value === Number.POSITIVE_INFINITY) return 1
  if (value === Number.NEGATIVE_INFINITY) return 0
  if (!Number.isFinite(value)) return Number.NaN
  return 0.5 * (1 + erf(value / SQRT_TWO))
}

/** Standard normal inverse CDF using Peter J. Acklam's rational approximation. */
export function normalInv(probability: number): number {
  if (!Number.isFinite(probability) || probability <= 0 || probability >= 1) return Number.NaN

  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239]
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1]
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783]
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416]
  const pLow = 0.02425
  const pHigh = 1 - pLow

  if (probability < pLow) {
    const q = Math.sqrt(-2 * Math.log(probability))
    return (((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) /
      ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1)
  }

  if (probability <= pHigh) {
    const q = probability - 0.5
    const r = q * q
    return (((((a[0]! * r + a[1]!) * r + a[2]!) * r + a[3]!) * r + a[4]!) * r + a[5]!) * q /
      (((((b[0]! * r + b[1]!) * r + b[2]!) * r + b[3]!) * r + b[4]!) * r + 1)
  }

  const q = Math.sqrt(-2 * Math.log(1 - probability))
  return -(((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) /
    ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1)
}

/**
 * Conditional win probability for a wager that wins when an integer score
 * variable finishes strictly above `threshold`. Whole-number pushes are removed
 * from the denominator, matching standard decimal line pricing.
 */
export function discreteConditionalWinProbabilityAbove(
  threshold: number,
  mean: number,
  sigma: number,
): number {
  return conditionalWinProbabilityAbove(threshold, mean, sigma, null)
}

/** The same probability, but with score support truncated to non-negative integers. */
export function truncatedDiscreteConditionalWinProbabilityAbove(
  threshold: number,
  mean: number,
  sigma: number,
): number {
  return conditionalWinProbabilityAbove(threshold, mean, sigma, 0)
}

/**
 * Infer the mean of an untruncated discrete-normal distribution from the fair
 * conditional win probability at a threshold.
 */
export function inferDiscreteNormalMeanFromConditionalWin(
  threshold: number,
  fairConditionalWinProbability: number,
  sigma: number,
): number {
  return inferMeanFromConditionalWin(threshold, fairConditionalWinProbability, sigma, null)
}

/** Infer a non-negative-total distribution mean from a conditional line price. */
export function inferTruncatedDiscreteNormalMeanFromConditionalWin(
  threshold: number,
  fairConditionalWinProbability: number,
  sigma: number,
): number {
  return inferMeanFromConditionalWin(threshold, fairConditionalWinProbability, sigma, 0)
}

function buildTotalsCandidates(
  quotes: readonly PointOutcomeQuote[],
  allAnchorQuotes: readonly PointOutcomeQuote[],
  options: ResolvedOptions,
  context: PairContext,
): MiddleOpportunity[] {
  const overs = bestUniqueQuotes(quotes.filter((quote) => normalizeOutcome(quote.outcome) === "over"))
  const unders = bestUniqueQuotes(quotes.filter((quote) => normalizeOutcome(quote.outcome) === "under"))
  const results: MiddleOpportunity[] = []

  for (const over of overs) {
    for (const under of unders) {
      if (normalizeBook(over.bookmaker) === normalizeBook(under.bookmaker)) continue
      if (!(over.point + EPSILON < under.point)) continue
      const opportunity = evaluatePair(
        "totals",
        over,
        under,
        undefined,
        allAnchorQuotes,
        options,
        context,
      )
      if (opportunity) results.push(opportunity)
    }
  }

  return dedupeCandidates(results)
}

function buildSpreadCandidates(
  quotes: readonly PointOutcomeQuote[],
  allAnchorQuotes: readonly PointOutcomeQuote[],
  referenceOutcome: string,
  options: ResolvedOptions,
  context: PairContext,
): MiddleOpportunity[] {
  const reference = bestUniqueQuotes(quotes.filter((quote) => sameOutcome(quote.outcome, referenceOutcome)))
  const opposite = bestUniqueQuotes(quotes.filter((quote) => !sameOutcome(quote.outcome, referenceOutcome)))
  const results: MiddleOpportunity[] = []

  for (const refQuote of reference) {
    for (const oppositeQuote of opposite) {
      if (normalizeBook(refQuote.bookmaker) === normalizeBook(oppositeQuote.bookmaker)) continue
      const lower = -refQuote.point
      const upper = oppositeQuote.point
      if (!(lower + EPSILON < upper)) continue
      const opportunity = evaluatePair(
        "spreads",
        refQuote,
        oppositeQuote,
        referenceOutcome,
        allAnchorQuotes,
        options,
        context,
      )
      if (opportunity) results.push(opportunity)
    }
  }

  return dedupeCandidates(results)
}

function evaluatePair(
  market: MiddleMarket,
  legAQuote: PointOutcomeQuote,
  legBQuote: PointOutcomeQuote,
  referenceOutcome: string | undefined,
  allAnchorQuotes: readonly PointOutcomeQuote[],
  options: ResolvedOptions,
  context: PairContext,
): MiddleOpportunity | null {
  const fractions = balancedMiddleStakeFractions(legAQuote.decimal, legBQuote.decimal)
  if (!fractions) return null

  const excludedBookmakers: [string, string] = [
    normalizeBook(legAQuote.bookmaker),
    normalizeBook(legBQuote.bookmaker),
  ].sort(compareText) as [string, string]
  const cacheKey = `${market}|${excludedBookmakers.join("|")}`
  let distribution = context.distributionCache.get(cacheKey)
  if (distribution === undefined) {
    const excludedSet = new Set(excludedBookmakers)
    const targetExcludedQuotes = allAnchorQuotes.filter(
      (quote) => !excludedSet.has(normalizeBook(quote.bookmaker)),
    )
    distribution = estimateDistribution(
      targetExcludedQuotes,
      market,
      referenceOutcome ?? "Over",
      options,
    )
    context.distributionCache.set(cacheKey, distribution)
  }
  if (!distribution) return null

  const lowerBound = market === "totals" ? legAQuote.point : -legAQuote.point
  const upperBound = legBQuote.point
  if (!(lowerBound + EPSILON < upperBound)) return null

  const landingValues = integerValuesStrictlyBetween(lowerBound, upperBound)
  if (landingValues.length === 0) return null

  const legA: MiddleLeg = { quote: legAQuote, stakeFraction: fractions[0] }
  const legB: MiddleLeg = { quote: legBQuote, stakeFraction: fractions[1] }
  const bothWinProfit = profitForStatuses(legA, legB, "win", "win")
  const outsideAProfit = profitForStatuses(legA, legB, "win", "loss")
  const outsideBProfit = profitForStatuses(legA, legB, "loss", "win")
  const outsideWindowProfit = Math.min(outsideAProfit, outsideBProfit)
  const lowerPushProfit = isIntegerLine(lowerBound)
    ? profitAtBoundary(market, lowerBound, legA, legB, referenceOutcome)
    : null
  const upperPushProfit = isIntegerLine(upperBound)
    ? profitAtBoundary(market, upperBound, legA, legB, referenceOutcome)
    : null
  const breakEvenMiddleProbability = bothWinProfit > outsideWindowProfit
    ? clamp(-outsideWindowProfit / (bothWinProfit - outsideWindowProfit), 0, 1)
    : 1

  const central = settlementMetrics(
    market,
    distribution.mean,
    distribution.sigma,
    legA,
    legB,
    referenceOutcome,
  )

  const scenarioModels = buildScenarioModels(distribution)
  const scenarioMetrics = scenarioModels.map((model) =>
    settlementMetrics(market, model.mean, model.sigma, legA, legB, referenceOutcome),
  )
  const conservativeMiddleProbability = Math.min(
    central.middleProbability,
    ...scenarioMetrics.map((metric) => metric.middleProbability),
  )
  const conservativeEvBeforeBuffer = Math.min(
    central.ev,
    ...scenarioMetrics.map((metric) => metric.ev),
  )
  const timing = targetTiming([legAQuote, legBQuote], options)
  const targetAnchorSkewSeconds =
    timing.averageAgeSeconds !== null && distribution.averageQuoteAgeSeconds !== null
      ? Math.abs(timing.averageAgeSeconds - distribution.averageQuoteAgeSeconds)
      : null
  const executionBufferApplied = calculateMiddleExecutionBuffer(
    timing.maximumAgeSeconds,
    timing.skewSeconds,
    targetAnchorSkewSeconds,
    options,
  )
  const conservativeEv = conservativeEvBeforeBuffer - executionBufferApplied
  const opportunityConfidence = calculateOpportunityConfidence(
    distribution.confidence,
    timing.maximumAgeSeconds,
    timing.skewSeconds,
    targetAnchorSkewSeconds,
    options,
  )
  const rejectionReasons: string[] = []

  if (!options.allowActionable) rejectionReasons.push("actionable_disabled")
  if (options.allowActionable && options.calibrationId === null) {
    rejectionReasons.push("missing_calibration_id")
  }
  if (distribution.completeBookCount < options.minCompleteBooks) rejectionReasons.push("insufficient_complete_books")
  if (distribution.distinctPointCount < options.minDistinctAnchorPoints) rejectionReasons.push("insufficient_distinct_anchor_points")
  if (distribution.fitQuality < options.minimumFitQuality) rejectionReasons.push("poor_market_fit")
  if (opportunityConfidence < options.minimumConfidence) rejectionReasons.push("low_model_confidence")
  if (conservativeMiddleProbability < options.minimumMiddleProbability) rejectionReasons.push("middle_probability_below_threshold")
  if (conservativeEv < options.minimumConservativeEv) rejectionReasons.push("conservative_ev_below_threshold")
  if (outsideWindowProfit < -options.maximumOutsideLoss) rejectionReasons.push("outside_window_loss_too_large")
  if (
    targetAnchorSkewSeconds !== null &&
    targetAnchorSkewSeconds * 1000 > options.maxTargetAnchorSkewMs
  ) {
    rejectionReasons.push("target_anchor_skew_too_large")
  }
  rejectionReasons.push(...timing.reasons)

  if (options.eventTimeMs !== null) {
    const minutesUntilEvent = (options.eventTimeMs - options.asOfMs) / 60_000
    if (minutesUntilEvent < options.minMinutesBeforeEvent) rejectionReasons.push("event_too_close_or_started")
  }

  return {
    market,
    status: rejectionReasons.length === 0 ? "actionable" : "candidate",
    modelVersion: "market-ladder-discrete-normal-v3",
    ...(options.calibrationId ? { calibrationId: options.calibrationId } : {}),
    ...(referenceOutcome ? { referenceOutcome } : {}),
    legs: [legA, legB],
    lowerBound,
    upperBound,
    landingValues: landingValues.slice(0, 25),
    windowLabel: formatWindowLabel(market, landingValues, referenceOutcome),
    bothWinProfit,
    outsideWindowProfit,
    lowerPushProfit,
    upperPushProfit,
    breakEvenMiddleProbability,
    estimatedMiddleProbability: central.middleProbability,
    conservativeMiddleProbability,
    probabilityBreakdown: central.breakdown,
    rawEv: central.ev,
    conservativeEv,
    executionBufferApplied,
    confidence: opportunityConfidence,
    distribution: stripInternalDistribution(distribution),
    keyNumbersInWindow: keyNumbersForSport(options.sportKey, landingValues, market),
    quoteAgeSeconds: timing.maximumAgeSeconds,
    targetQuoteSkewSeconds: timing.skewSeconds,
    targetAnchorSkewSeconds,
    excludedBookmakers,
    rejectionReasons: unique(rejectionReasons),
  }
}

function estimateDistribution(
  quotes: readonly PointOutcomeQuote[],
  market: MiddleMarket,
  referenceOutcome: string,
  options: ResolvedOptions,
): FittedDistribution | null {
  const priorSigma = market === "spreads" ? options.prior.spreadSigma : options.prior.totalSigma
  if (!Number.isFinite(priorSigma) || (priorSigma ?? 0) <= 0) return null

  const observations = buildMarketObservations(quotes, market, referenceOutcome, options)
  if (observations.length === 0) return null

  const centralFit = fitObservationDistribution(
    observations,
    market,
    priorSigma!,
    options,
  )
  if (!centralFit) return null

  const bookWeights = aggregateBookWeights(observations)
  const completeBookCount = bookWeights.size
  const groupWeights = aggregateCorrelationGroupWeights(observations, options)
  const correlationGroupCount = groupWeights.size
  const effectiveBookCount = calculateEffectiveBookCount([...groupWeights.values()])
  const distinctPointCount = new Set(observations.map((observation) => pointKey(observation.threshold))).size
  const quoteAges = observations
    .map((observation) => observation.quoteAgeSeconds)
    .filter((age): age is number => age !== null)
  const weightedKnownAge = weightedMeanNullable(
    observations.map((observation) => observation.quoteAgeSeconds),
    observations.map((observation) => observation.weight),
  )
  const averageQuoteAgeSeconds = quoteAges.length > 0 ? weightedKnownAge : null
  const sharpAnchorPresent = observations.some((observation) => observation.isSharp)
  const methodDisagreement = weightedMean(
    observations.map((observation) => observation.methodStdev),
    observations.map((observation) => observation.weight),
  )

  const jackknifeModels: Array<{ mean: number; sigma: number }> = []
  if (completeBookCount >= 3 && options.maxJackknifeBooks > 0) {
    const selectedBooks = [...bookWeights.entries()]
      .sort((a, b) => b[1] - a[1] || compareText(a[0], b[0]))
      .slice(0, options.maxJackknifeBooks)
      .map(([book]) => book)

    for (const removedBook of selectedBooks) {
      const remaining = observations.filter((observation) => observation.bookmaker !== removedBook)
      if (new Set(remaining.map((observation) => observation.bookmaker)).size < 2) continue
      const fit = fitObservationDistribution(remaining, market, priorSigma!, options)
      if (fit) jackknifeModels.push({ mean: fit.mean, sigma: fit.sigma })
    }
  }

  const jackknifeMeanShift = jackknifeModels.length > 0
    ? Math.max(...jackknifeModels.map((model) => Math.abs(model.mean - centralFit.mean)))
    : 0
  const jackknifeSigmaFraction = jackknifeModels.length > 0
    ? Math.max(...jackknifeModels.map((model) => Math.abs(model.sigma - centralFit.sigma) / centralFit.sigma))
    : 0

  const impliedMeans = observations.map((observation) =>
    inferMeanForMarket(
      market,
      observation.threshold,
      observation.fairConditionalWinProbability,
      centralFit.sigma,
    ),
  )
  const agreementStdev = weightedStdev(
    impliedMeans,
    observations.map((observation) => observation.weight),
    centralFit.mean,
  )
  const meanUncertainty = Math.max(
    options.prior.meanUncertaintyFloor,
    agreementStdev / Math.sqrt(Math.max(1, effectiveBookCount)),
    centralFit.fitRmse * centralFit.sigma * 1.5,
    centralFit.sigma * 0.02,
    jackknifeMeanShift,
  )
  const sigmaUncertaintyFraction = clamp(
    Math.max(
      options.prior.sigmaUncertaintyFraction,
      jackknifeSigmaFraction,
      methodDisagreement * 2,
    ),
    0.05,
    0.65,
  )

  const depthScore = clamp(effectiveBookCount / 6, 0, 1)
  const pointCoverageScore = clamp(distinctPointCount / Math.max(2, options.minDistinctAnchorPoints + 1), 0, 1)
  const fitScore = centralFit.fitQuality
  const agreementScore = clamp(1 - agreementStdev / Math.max(centralFit.sigma * 0.18, 0.35), 0, 1)
  const sharpScore = sharpAnchorPresent ? 1 : 0.45
  const freshnessScore = averageQuoteAgeSeconds === null
    ? options.requireQuoteTimestamps ? 0 : 0.5
    : clamp(1 - (averageQuoteAgeSeconds * 1000) / options.maxQuoteAgeMs, 0, 1)
  const jackknifeScore = clamp(
    1 - Math.max(jackknifeMeanShift / Math.max(centralFit.sigma * 0.15, 0.5), jackknifeSigmaFraction / 0.35),
    0,
    1,
  )
  const confidence = Math.round(100 * (
    0.20 * depthScore +
    0.18 * pointCoverageScore +
    0.22 * fitScore +
    0.15 * agreementScore +
    0.12 * sharpScore +
    0.07 * freshnessScore +
    0.06 * jackknifeScore
  ))

  return {
    mean: centralFit.mean,
    sigma: centralFit.sigma,
    priorSigma: priorSigma!,
    fitMethod: centralFit.fitMethod,
    fitRmse: centralFit.fitRmse,
    fitQuality: centralFit.fitQuality,
    meanUncertainty,
    effectiveBookCount,
    completeBookCount,
    correlationGroupCount,
    observationCount: observations.length,
    distinctPointCount,
    sharpAnchorPresent,
    confidence: clamp(confidence, 0, 100),
    averageQuoteAgeSeconds,
    sigmaUncertaintyFraction,
    methodDisagreement,
    jackknifeMeanShift,
    jackknifeSigmaFraction,
    anchorBookmakers: [...bookWeights.keys()].sort(compareText),
    jackknifeModels,
  }
}

function fitObservationDistribution(
  observations: readonly MarketObservation[],
  market: MiddleMarket,
  priorSigma: number,
  options: ResolvedOptions,
): {
  mean: number
  sigma: number
  fitMethod: "prior_sigma" | "market_ladder"
  fitRmse: number
  fitQuality: number
} | null {
  if (observations.length === 0 || !Number.isFinite(priorSigma) || priorSigma <= 0) return null
  const distinctPointCount = new Set(observations.map((observation) => pointKey(observation.threshold))).size
  const canFitSigma = options.fitSigmaFromMarket && distinctPointCount >= options.minDistinctAnchorPoints

  const lowerSigma = priorSigma * options.prior.sigmaLowerMultiplier
  const upperSigma = priorSigma * options.prior.sigmaUpperMultiplier
  let best: { mean: number; sigma: number; objective: number } | null = null

  if (canFitSigma) {
    let lowerLog = Math.log(lowerSigma)
    let upperLog = Math.log(upperSigma)
    for (let refinement = 0; refinement < 4; refinement += 1) {
      const grid = 25
      let bestIndex = 0
      for (let index = 0; index < grid; index += 1) {
        const ratio = index / (grid - 1)
        const sigma = Math.exp(lowerLog + ratio * (upperLog - lowerLog))
        const candidate = evaluateSigma(observations, market, sigma, priorSigma, options)
        if (candidate && (best === null || candidate.objective < best.objective)) {
          best = candidate
          bestIndex = index
        }
      }
      const step = (upperLog - lowerLog) / (grid - 1)
      const center = lowerLog + bestIndex * step
      lowerLog = Math.max(Math.log(lowerSigma), center - 2 * step)
      upperLog = Math.min(Math.log(upperSigma), center + 2 * step)
    }
  } else {
    best = evaluateSigma(observations, market, priorSigma, priorSigma, options)
  }
  if (!best) return null

  const squaredErrors = observations.map((observation) => {
    const predicted = conditionalProbabilityForMarket(
      market,
      observation.threshold,
      best!.mean,
      best!.sigma,
    )
    return (predicted - observation.fairConditionalWinProbability) ** 2
  })
  const fitRmse = Math.sqrt(weightedMean(squaredErrors, observations.map((observation) => observation.weight)))
  const coverage = clamp(distinctPointCount / Math.max(2, options.minDistinctAnchorPoints + 1), 0.5, 1)
  const fitQuality = clamp((1 - fitRmse / 0.08) * coverage, 0, 1)

  return {
    mean: best.mean,
    sigma: best.sigma,
    fitMethod: canFitSigma ? "market_ladder" : "prior_sigma",
    fitRmse,
    fitQuality,
  }
}

function evaluateSigma(
  observations: readonly MarketObservation[],
  market: MiddleMarket,
  sigma: number,
  priorSigma: number,
  options: ResolvedOptions,
): { mean: number; sigma: number; objective: number } | null {
  const impliedMeans = observations.map((observation) =>
    inferMeanForMarket(
      market,
      observation.threshold,
      observation.fairConditionalWinProbability,
      sigma,
    ),
  )
  if (impliedMeans.some((value) => !Number.isFinite(value))) return null
  const weights = observations.map((observation) => observation.weight)
  const mean = robustWeightedCenter(impliedMeans, weights)
  if (!Number.isFinite(mean)) return null

  let weightedLoss = 0
  let totalWeight = 0
  for (let index = 0; index < observations.length; index += 1) {
    const observation = observations[index]
    if (!observation) continue
    const predicted = conditionalProbabilityForMarket(market, observation.threshold, mean, sigma)
    if (!Number.isFinite(predicted)) return null
    const residual = logit(predicted) - logit(observation.fairConditionalWinProbability)
    weightedLoss += observation.weight * huberLoss(residual, 0.35)
    totalWeight += observation.weight
  }
  if (totalWeight <= 0) return null
  const regularization = options.prior.sigmaRegularization * Math.log(sigma / priorSigma) ** 2
  return { mean, sigma, objective: weightedLoss / totalWeight + regularization }
}

function buildMarketObservations(
  quotes: readonly PointOutcomeQuote[],
  market: MiddleMarket,
  referenceOutcome: string,
  options: ResolvedOptions,
): MarketObservation[] {
  const grouped = new Map<string, PointOutcomeQuote[]>()
  for (const quote of quotes) {
    const bookmaker = normalizeBook(quote.bookmaker)
    const current = grouped.get(bookmaker) ?? []
    current.push(quote)
    grouped.set(bookmaker, current)
  }

  const observations: MarketObservation[] = []
  for (const [bookmaker, bookQuotes] of grouped) {
    const pairs = allCompleteLinePairs(bookQuotes, market, referenceOutcome)
    if (pairs.length === 0) continue
    const reliability = options.bookmakerWeights.get(bookmaker) ?? (options.sharpBookmakers.has(bookmaker) ? 3 : 1)
    const perPairReliability = reliability / pairs.length

    for (const [reference, opposite] of pairs) {
      const power = powerDevig2(reference.decimal, opposite.decimal)
      const proportional = proportionalDevig(reference.decimal, opposite.decimal)
      if (!power || !proportional) continue
      const overround = 1 / reference.decimal + 1 / opposite.decimal
      if (overround < 0.9 || overround > 1.25) continue
      const quoteAgeSeconds = maximumQuoteAgeSeconds([reference, opposite], options.asOfMs)
      if (options.requireQuoteTimestamps && quoteAgeSeconds === null) continue
      if (quoteAgeSeconds !== null && quoteAgeSeconds * 1000 > options.maxQuoteAgeMs) continue

      const freshness = quoteAgeSeconds === null
        ? 0.5
        : Math.max(0.05, 2 ** (-(quoteAgeSeconds * 1000) / Math.max(options.maxQuoteAgeMs, 1)))
      const holdWeight = 1 / (1 + Math.abs(overround - 1) * 20)
      const weight = perPairReliability * freshness * holdWeight
      if (!Number.isFinite(weight) || weight <= 0) continue
      const threshold = market === "totals" ? reference.point : -reference.point

      observations.push({
        bookmaker,
        threshold,
        fairConditionalWinProbability: power[0],
        methodStdev: Math.abs(power[0] - proportional[0]),
        overround,
        weight,
        quoteAgeSeconds,
        isSharp: options.sharpBookmakers.has(bookmaker),
      })
    }
  }

  applyObservationWeightCaps(observations, options)
  return observations
}

/** Return every matched pair, keeping at most one lowest-hold pair per threshold. */
function allCompleteLinePairs(
  quotes: readonly PointOutcomeQuote[],
  market: MiddleMarket,
  referenceOutcome: string,
): Array<[PointOutcomeQuote, PointOutcomeQuote]> {
  const references = market === "totals"
    ? quotes.filter((quote) => normalizeOutcome(quote.outcome) === "over")
    : quotes.filter((quote) => sameOutcome(quote.outcome, referenceOutcome))
  const opposites = market === "totals"
    ? quotes.filter((quote) => normalizeOutcome(quote.outcome) === "under")
    : quotes.filter((quote) => !sameOutcome(quote.outcome, referenceOutcome))
  const byThreshold = new Map<string, [PointOutcomeQuote, PointOutcomeQuote]>()

  for (const reference of references) {
    for (const opposite of opposites) {
      const pointsMatch = market === "totals"
        ? Math.abs(reference.point - opposite.point) <= EPSILON
        : Math.abs(reference.point + opposite.point) <= EPSILON
      if (!pointsMatch) continue
      const threshold = market === "totals" ? reference.point : -reference.point
      const key = pointKey(threshold)
      const candidate: [PointOutcomeQuote, PointOutcomeQuote] = [reference, opposite]
      const current = byThreshold.get(key)
      if (!current || pairPreference(candidate, current) < 0) byThreshold.set(key, candidate)
    }
  }

  return [...byThreshold.values()].sort((a, b) => {
    const thresholdA = market === "totals" ? a[0].point : -a[0].point
    const thresholdB = market === "totals" ? b[0].point : -b[0].point
    return thresholdA - thresholdB
  })
}

function settlementMetrics(
  market: MiddleMarket,
  mean: number,
  sigma: number,
  legA: MiddleLeg,
  legB: MiddleLeg,
  referenceOutcome: string | undefined,
): SettlementMetrics {
  const lowerSupport = market === "totals" ? 0 : null
  const low = lowerSupport ?? Math.floor(mean - 9 * sigma)
  const high = Math.max(low, Math.ceil(mean + 9 * sigma))
  const breakdown: MiddleProbabilityBreakdown = {
    bothWin: 0,
    legAOnly: 0,
    legBOnly: 0,
    pushMix: 0,
    bothLoss: 0,
  }
  let ev = 0
  let captured = 0

  for (let value = low; value <= high; value += 1) {
    const probability = discreteMassForMarket(market, value, mean, sigma)
    if (probability <= 0) continue
    captured += probability
    const statuses = settlementStatuses(market, value, legA.quote, legB.quote, referenceOutcome)
    ev += probability * profitForStatuses(legA, legB, statuses[0], statuses[1])
    addBreakdown(breakdown, statuses, probability)
  }

  if (market === "spreads") {
    const lowerTail = normalCdf((low - 0.5 - mean) / sigma)
    if (lowerTail > 0) {
      const statuses = settlementStatuses(market, low - 1, legA.quote, legB.quote, referenceOutcome)
      captured += lowerTail
      ev += lowerTail * profitForStatuses(legA, legB, statuses[0], statuses[1])
      addBreakdown(breakdown, statuses, lowerTail)
    }
  }

  const upperTail = upperTailProbability(market, high, mean, sigma)
  if (upperTail > 0) {
    const statuses = settlementStatuses(market, high + 1, legA.quote, legB.quote, referenceOutcome)
    captured += upperTail
    ev += upperTail * profitForStatuses(legA, legB, statuses[0], statuses[1])
    addBreakdown(breakdown, statuses, upperTail)
  }

  if (captured <= 0 || !Number.isFinite(captured)) {
    return { ev: Number.NaN, middleProbability: Number.NaN, breakdown }
  }
  if (Math.abs(captured - 1) > 1e-8) {
    ev /= captured
    for (const key of Object.keys(breakdown) as Array<keyof MiddleProbabilityBreakdown>) {
      breakdown[key] /= captured
    }
  }

  return { ev, middleProbability: clamp(breakdown.bothWin, 0, 1), breakdown }
}

type BetStatus = "win" | "push" | "loss"

function settlementStatuses(
  market: MiddleMarket,
  scoreVariable: number,
  legA: PointOutcomeQuote,
  legB: PointOutcomeQuote,
  referenceOutcome: string | undefined,
): [BetStatus, BetStatus] {
  if (market === "totals") {
    return [
      compareToZero(scoreVariable - legA.point),
      compareToZero(legB.point - scoreVariable),
    ]
  }
  if (!referenceOutcome) return ["loss", "loss"]
  return [
    compareToZero(scoreVariable + legA.point),
    compareToZero(-scoreVariable + legB.point),
  ]
}

function profitAtBoundary(
  market: MiddleMarket,
  boundary: number,
  legA: MiddleLeg,
  legB: MiddleLeg,
  referenceOutcome: string | undefined,
): number {
  const statuses = settlementStatuses(market, boundary, legA.quote, legB.quote, referenceOutcome)
  return profitForStatuses(legA, legB, statuses[0], statuses[1])
}

function profitForStatuses(
  legA: MiddleLeg,
  legB: MiddleLeg,
  statusA: BetStatus,
  statusB: BetStatus,
): number {
  const grossA = statusA === "win"
    ? legA.stakeFraction * legA.quote.decimal
    : statusA === "push"
      ? legA.stakeFraction
      : 0
  const grossB = statusB === "win"
    ? legB.stakeFraction * legB.quote.decimal
    : statusB === "push"
      ? legB.stakeFraction
      : 0
  return grossA + grossB - 1
}

function addBreakdown(
  breakdown: MiddleProbabilityBreakdown,
  statuses: readonly [BetStatus, BetStatus],
  probability: number,
): void {
  if (statuses[0] === "win" && statuses[1] === "win") breakdown.bothWin += probability
  else if (statuses[0] === "win" && statuses[1] === "loss") breakdown.legAOnly += probability
  else if (statuses[0] === "loss" && statuses[1] === "win") breakdown.legBOnly += probability
  else if (statuses[0] === "push" || statuses[1] === "push") breakdown.pushMix += probability
  else breakdown.bothLoss += probability
}

function conditionalWinProbabilityAbove(
  threshold: number,
  mean: number,
  sigma: number,
  lowerSupport: number | null,
): number {
  if (!Number.isFinite(threshold) || !Number.isFinite(mean) || !Number.isFinite(sigma) || sigma <= 0) {
    return Number.NaN
  }
  const denominator = lowerSupport === null
    ? 1
    : 1 - normalCdf((lowerSupport - 0.5 - mean) / sigma)
  if (!Number.isFinite(denominator) || denominator <= EPSILON) return Number.NaN

  const floor = Math.floor(threshold)
  const rawWin = 1 - normalCdf((floor + 0.5 - mean) / sigma)
  const winProbability = rawWin / denominator
  const pushProbability = isIntegerLine(threshold)
    ? discreteNormalMass(Math.round(threshold), mean, sigma) / denominator
    : 0
  const resolvedProbability = Math.max(EPSILON, 1 - pushProbability)
  return clamp(winProbability / resolvedProbability, 0, 1)
}

function inferMeanFromConditionalWin(
  threshold: number,
  fairConditionalWinProbability: number,
  sigma: number,
  lowerSupport: number | null,
): number {
  if (!Number.isFinite(threshold) || !Number.isFinite(sigma) || sigma <= 0) return Number.NaN
  const target = clamp(fairConditionalWinProbability, 1e-6, 1 - 1e-6)
  let lower = lowerSupport === null
    ? threshold - 14 * sigma - 4
    : Math.max(-8 * sigma, lowerSupport - 8 * sigma)
  let upper = threshold + 14 * sigma + 4

  for (let iteration = 0; iteration < 90; iteration += 1) {
    const midpoint = (lower + upper) / 2
    const probability = conditionalWinProbabilityAbove(threshold, midpoint, sigma, lowerSupport)
    if (!Number.isFinite(probability)) return Number.NaN
    if (probability < target) lower = midpoint
    else upper = midpoint
  }
  return (lower + upper) / 2
}

function conditionalProbabilityForMarket(
  market: MiddleMarket,
  threshold: number,
  mean: number,
  sigma: number,
): number {
  return market === "totals"
    ? truncatedDiscreteConditionalWinProbabilityAbove(threshold, mean, sigma)
    : discreteConditionalWinProbabilityAbove(threshold, mean, sigma)
}

function inferMeanForMarket(
  market: MiddleMarket,
  threshold: number,
  fairProbability: number,
  sigma: number,
): number {
  return market === "totals"
    ? inferTruncatedDiscreteNormalMeanFromConditionalWin(threshold, fairProbability, sigma)
    : inferDiscreteNormalMeanFromConditionalWin(threshold, fairProbability, sigma)
}

function discreteMassForMarket(
  market: MiddleMarket,
  integer: number,
  mean: number,
  sigma: number,
): number {
  if (market === "spreads") return discreteNormalMass(integer, mean, sigma)
  if (integer < 0) return 0
  const denominator = 1 - normalCdf((-0.5 - mean) / sigma)
  return denominator > EPSILON ? discreteNormalMass(integer, mean, sigma) / denominator : 0
}

function upperTailProbability(
  market: MiddleMarket,
  high: number,
  mean: number,
  sigma: number,
): number {
  const raw = 1 - normalCdf((high + 0.5 - mean) / sigma)
  if (market === "spreads") return raw
  const denominator = 1 - normalCdf((-0.5 - mean) / sigma)
  return denominator > EPSILON ? raw / denominator : 0
}

function buildScenarioModels(
  distribution: FittedDistribution,
): Array<{ mean: number; sigma: number }> {
  const scenarios: Array<{ mean: number; sigma: number }> = []
  const meanOffsets = [-distribution.meanUncertainty, 0, distribution.meanUncertainty]
  const multipliers = [
    Math.max(0.35, 1 - distribution.sigmaUncertaintyFraction),
    1,
    1 + distribution.sigmaUncertaintyFraction,
  ]
  for (const meanOffset of meanOffsets) {
    for (const multiplier of multipliers) {
      scenarios.push({
        mean: distribution.mean + meanOffset,
        sigma: Math.max(0.35, distribution.sigma * multiplier),
      })
    }
  }
  scenarios.push(...distribution.jackknifeModels)
  return dedupeModels(scenarios)
}

function calculateMiddleExecutionBuffer(
  maximumAgeSeconds: number | null,
  targetLegSkewSeconds: number | null,
  targetAnchorSkewSeconds: number | null,
  options: ResolvedOptions,
): number {
  const ageRatio = maximumAgeSeconds === null
    ? 0.5
    : clamp(Math.max(0, maximumAgeSeconds * 1000) / Math.max(1, options.maxQuoteAgeMs), 0, 1)
  const legSkewRatio = targetLegSkewSeconds === null
    ? 0.5
    : clamp((targetLegSkewSeconds * 1000) / Math.max(1, options.maxTargetQuoteSkewMs), 0, 1)
  const anchorSkewRatio = targetAnchorSkewSeconds === null
    ? 0.5
    : clamp((targetAnchorSkewSeconds * 1000) / Math.max(1, options.maxTargetAnchorSkewMs), 0, 1)
  return options.executionBuffer +
    options.ageExecutionBuffer * ageRatio +
    options.skewExecutionBuffer * Math.max(legSkewRatio, anchorSkewRatio)
}

function calculateOpportunityConfidence(
  distributionConfidence: number,
  maximumAgeSeconds: number | null,
  targetLegSkewSeconds: number | null,
  targetAnchorSkewSeconds: number | null,
  options: ResolvedOptions,
): number {
  const freshness = maximumAgeSeconds === null
    ? 0.5
    : clamp(1 - Math.max(0, maximumAgeSeconds * 1000) / Math.max(1, options.maxQuoteAgeMs), 0, 1)
  const legAgreement = targetLegSkewSeconds === null
    ? 0.5
    : clamp(1 - (targetLegSkewSeconds * 1000) / Math.max(1, options.maxTargetQuoteSkewMs), 0, 1)
  const anchorAgreement = targetAnchorSkewSeconds === null
    ? 0.5
    : clamp(1 - (targetAnchorSkewSeconds * 1000) / Math.max(1, options.maxTargetAnchorSkewMs), 0, 1)
  return Math.round(clamp(
    0.75 * (distributionConfidence / 100) +
      0.10 * freshness +
      0.075 * legAgreement +
      0.075 * anchorAgreement,
    0,
    1,
  ) * 100)
}

function applyObservationWeightCaps(
  observations: MarketObservation[],
  options: ResolvedOptions,
): void {
  if (observations.length === 0) return

  const sharpWeight = observations
    .filter((observation) => observation.isSharp)
    .reduce((total, observation) => total + observation.weight, 0)
  const soft = observations.filter((observation) => !observation.isSharp)
  const softWeight = soft.reduce((total, observation) => total + observation.weight, 0)
  if (sharpWeight > EPSILON && softWeight > sharpWeight * options.maxSoftToSharpWeightRatio) {
    const scale = (sharpWeight * options.maxSoftToSharpWeightRatio) / softWeight
    for (const observation of soft) observation.weight *= scale
  }

  const bookWeights = aggregateBookWeights(observations)
  const booksByGroup = new Map<string, string[]>()
  for (const book of bookWeights.keys()) {
    const group = options.bookmakerCorrelationGroups.get(book) ?? book
    const books = booksByGroup.get(group) ?? []
    books.push(book)
    booksByGroup.set(group, books)
  }
  for (const books of booksByGroup.values()) {
    if (books.length < 2) continue
    const groupTotal = books.reduce((total, book) => total + (bookWeights.get(book) ?? 0), 0)
    const strongestBook = Math.max(...books.map((book) => bookWeights.get(book) ?? 0))
    const maximumGroupWeight = strongestBook * options.correlationGroupWeightCap
    if (groupTotal <= maximumGroupWeight + EPSILON) continue
    const scale = maximumGroupWeight / groupTotal
    const bookSet = new Set(books)
    for (const observation of observations) {
      if (bookSet.has(observation.bookmaker)) observation.weight *= scale
    }
  }
}

function aggregateCorrelationGroupWeights(
  observations: readonly MarketObservation[],
  options: ResolvedOptions,
): Map<string, number> {
  const result = new Map<string, number>()
  for (const observation of observations) {
    const group = options.bookmakerCorrelationGroups.get(observation.bookmaker) ?? observation.bookmaker
    result.set(group, (result.get(group) ?? 0) + observation.weight)
  }
  return result
}

function resolveOptions(options: MiddleOptions): ResolvedOptions | null {
  const asOfMs = Date.parse(options.asOf)
  if (!Number.isFinite(asOfMs)) return null
  const eventTimeMs = options.eventTime ? Date.parse(options.eventTime) : null
  if (eventTimeMs !== null && !Number.isFinite(eventTimeMs)) return null
  const basePrior = SPORT_PRIORS[options.sportKey]
  const mergedPrior = { ...(basePrior ?? {}), ...(options.prior ?? {}) }
  const prior = {
    ...mergedPrior,
    sigmaUncertaintyFraction: clamp(mergedPrior.sigmaUncertaintyFraction ?? 0.2, 0.05, 0.6),
    meanUncertaintyFloor: Math.max(0.1, mergedPrior.meanUncertaintyFloor ?? 0.5),
    sigmaLowerMultiplier: clamp(mergedPrior.sigmaLowerMultiplier ?? 0.6, 0.25, 1),
    sigmaUpperMultiplier: clamp(mergedPrior.sigmaUpperMultiplier ?? 1.6, 1, 3),
    sigmaRegularization: Math.max(0, mergedPrior.sigmaRegularization ?? 0.02),
  }
  const bookmakerWeights = new Map<string, number>()
  const bookmakerCorrelationGroups = new Map<string, string>()
  for (const [book, weight] of Object.entries(options.bookmakerWeights ?? {})) {
    if (normalizeBook(book) && Number.isFinite(weight) && weight > 0) {
      bookmakerWeights.set(normalizeBook(book), weight)
    }
  }

  for (const [book, group] of Object.entries(options.bookmakerCorrelationGroups ?? {})) {
    const bookKey = normalizeBook(book)
    const groupKey = normalizeBook(group)
    if (bookKey && groupKey) bookmakerCorrelationGroups.set(bookKey, groupKey)
  }

  const calibrationId = options.calibrationId?.trim() || null

  return {
    sportKey: options.sportKey,
    ...(options.homeTeam ? { homeTeam: options.homeTeam } : {}),
    ...(options.awayTeam ? { awayTeam: options.awayTeam } : {}),
    sharpBookmakers: new Set((options.sharpBookmakers ?? ["pinnacle"]).map(normalizeBook)),
    eligibleBookmakers: options.eligibleBookmakers
      ? new Set(options.eligibleBookmakers.map(normalizeBook))
      : null,
    bookmakerWeights,
    bookmakerCorrelationGroups,
    maxSoftToSharpWeightRatio: positiveOr(options.maxSoftToSharpWeightRatio, 1.5),
    correlationGroupWeightCap: positiveOr(options.correlationGroupWeightCap, 1.25),
    asOfMs,
    eventTimeMs,
    maxQuoteAgeMs: positiveOr(options.maxQuoteAgeMs, 4 * 60_000),
    maxTargetQuoteSkewMs: positiveOr(options.maxTargetQuoteSkewMs, 45_000),
    maxTargetAnchorSkewMs: positiveOr(options.maxTargetAnchorSkewMs, 90_000),
    maxFutureQuoteSkewMs: positiveOr(options.maxFutureQuoteSkewMs, 5_000),
    requireQuoteTimestamps: options.requireQuoteTimestamps ?? true,
    minCompleteBooks: Math.max(2, Math.floor(positiveOr(options.minCompleteBooks, 3))),
    minDistinctAnchorPoints: Math.max(1, Math.floor(positiveOr(options.minDistinctAnchorPoints, 2))),
    fitSigmaFromMarket: options.fitSigmaFromMarket ?? true,
    minimumFitQuality: clamp(options.minimumFitQuality ?? 0.45, 0, 1),
    minimumConfidence: clamp(options.minimumConfidence ?? 68, 0, 100),
    minimumConservativeEv: options.minimumConservativeEv ?? 0.005,
    minimumMiddleProbability: clamp(options.minimumMiddleProbability ?? 0.025, 0, 1),
    maximumOutsideLoss: clamp(options.maximumOutsideLoss ?? 0.06, 0, 1),
    executionBuffer: Math.max(0, options.executionBuffer ?? 0.0035),
    ageExecutionBuffer: Math.max(0, options.ageExecutionBuffer ?? 0.0025),
    skewExecutionBuffer: Math.max(0, options.skewExecutionBuffer ?? 0.0035),
    allowActionable: options.allowActionable ?? false,
    calibrationId,
    minMinutesBeforeEvent: Math.max(0, options.minMinutesBeforeEvent ?? 10),
    maxCandidates: Math.max(1, Math.floor(positiveOr(options.maxCandidates, 6))),
    maxJackknifeBooks: Math.max(0, Math.floor(nonNegativeOr(options.maxJackknifeBooks, 8))),
    prior,
  }
}

function sanitizeQuotes(
  quotes: readonly PointOutcomeQuote[],
  options: ResolvedOptions,
): PointOutcomeQuote[] {
  return quotes.filter((quote) => {
    if (!quote.outcome.trim() || !normalizeBook(quote.bookmaker)) return false
    if (!isValidDecimal(quote.decimal) || !Number.isFinite(quote.point)) return false
    if (quote.market !== "spreads" && quote.market !== "totals") return false
    // Quarter lines need split-payoff calibration. Settlement supports them,
    // but the middle model intentionally fails closed until separately trained.
    if (isAsianQuarterLine(quote.point)) return false
    const age = quoteAgeSeconds(quote.lastUpdate, options.asOfMs)
    if (options.requireQuoteTimestamps && age === null) return false
    if (age !== null && (age * 1000 < -options.maxFutureQuoteSkewMs || age * 1000 > options.maxQuoteAgeMs)) {
      return false
    }
    return true
  })
}

function targetTiming(
  quotes: readonly PointOutcomeQuote[],
  options: ResolvedOptions,
): {
  maximumAgeSeconds: number | null
  averageAgeSeconds: number | null
  skewSeconds: number | null
  reasons: string[]
} {
  const ages = quotes.map((quote) => quoteAgeSeconds(quote.lastUpdate, options.asOfMs))
  const reasons: string[] = []
  if (ages.some((age) => age === null)) {
    if (options.requireQuoteTimestamps) reasons.push("missing_target_timestamp")
    return { maximumAgeSeconds: null, averageAgeSeconds: null, skewSeconds: null, reasons }
  }

  const numeric = ages as number[]
  const maximumAgeSeconds = Math.max(...numeric)
  const minimumAgeSeconds = Math.min(...numeric)
  const averageAgeSeconds = numeric.reduce((total, age) => total + age, 0) / numeric.length
  const skewSeconds = Math.max(...numeric) - Math.min(...numeric)
  if (minimumAgeSeconds * 1000 < -options.maxFutureQuoteSkewMs) reasons.push("future_target_timestamp")
  if (maximumAgeSeconds * 1000 > options.maxQuoteAgeMs) reasons.push("stale_target_quote")
  if (skewSeconds * 1000 > options.maxTargetQuoteSkewMs) reasons.push("target_quote_skew_too_large")
  return { maximumAgeSeconds, averageAgeSeconds, skewSeconds, reasons }
}

function commonMarket(quotes: readonly PointOutcomeQuote[]): MiddleMarket | null {
  const markets = new Set(quotes.map((quote) => quote.market))
  if (markets.size !== 1) return null
  const market = quotes[0]?.market
  return market === "spreads" || market === "totals" ? market : null
}

function resolveReferenceOutcome(
  quotes: readonly PointOutcomeQuote[],
  options: ResolvedOptions,
): string | null {
  if (options.homeTeam && quotes.some((quote) => sameOutcome(quote.outcome, options.homeTeam!))) {
    return options.homeTeam
  }
  const counts = new Map<string, { label: string; count: number }>()
  for (const quote of quotes) {
    const key = normalizeOutcome(quote.outcome)
    const current = counts.get(key)
    counts.set(key, { label: quote.outcome, count: (current?.count ?? 0) + 1 })
  }
  const sorted = [...counts.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
  return sorted[0]?.label ?? null
}

function powerDevig2(decimalA: number, decimalB: number): [number, number] | null {
  if (!isValidDecimal(decimalA) || !isValidDecimal(decimalB)) return null
  const rawA = 1 / decimalA
  const rawB = 1 / decimalB
  const fn = (exponent: number): number => rawA ** exponent + rawB ** exponent - 1
  let lower = 0.01
  let upper = 100
  if (fn(lower) < 0 || fn(upper) > 0) return proportionalDevig(decimalA, decimalB)
  for (let iteration = 0; iteration < 100; iteration += 1) {
    const midpoint = (lower + upper) / 2
    if (fn(midpoint) > 0) lower = midpoint
    else upper = midpoint
  }
  const exponent = (lower + upper) / 2
  const a = rawA ** exponent
  const b = rawB ** exponent
  const total = a + b
  return total > 0 ? [a / total, b / total] : null
}

function proportionalDevig(decimalA: number, decimalB: number): [number, number] | null {
  if (!isValidDecimal(decimalA) || !isValidDecimal(decimalB)) return null
  const impliedA = 1 / decimalA
  const impliedB = 1 / decimalB
  const total = impliedA + impliedB
  if (!Number.isFinite(total) || total <= 0) return null
  return [impliedA / total, impliedB / total]
}

function discreteNormalMass(integer: number, mean: number, sigma: number): number {
  if (!Number.isFinite(integer) || !Number.isFinite(mean) || !Number.isFinite(sigma) || sigma <= 0) return 0
  const upper = normalCdf((integer + 0.5 - mean) / sigma)
  const lower = normalCdf((integer - 0.5 - mean) / sigma)
  return Math.max(0, upper - lower)
}

function robustWeightedCenter(values: readonly number[], weights: readonly number[]): number {
  let center = weightedMedian(values, weights)
  if (!Number.isFinite(center)) return Number.NaN
  for (let iteration = 0; iteration < 4; iteration += 1) {
    const deviations = values.map((value) => Math.abs(value - center))
    const scale = Math.max(1.4826 * weightedMedian(deviations, weights), 0.05)
    const robustWeights = weights.map((weight, index) => {
      const z = Math.abs((values[index] ?? center) - center) / scale
      return weight * (z <= 1.5 ? 1 : 1.5 / z)
    })
    center = weightedMean(values, robustWeights)
  }
  return center
}

function weightedMedian(values: readonly number[], weights: readonly number[]): number {
  const entries = values
    .map((value, index) => ({ value, weight: weights[index] ?? 0 }))
    .filter((entry) => Number.isFinite(entry.value) && Number.isFinite(entry.weight) && entry.weight > 0)
    .sort((a, b) => a.value - b.value)
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0)
  if (total <= 0) return Number.NaN
  let cumulative = 0
  for (const entry of entries) {
    cumulative += entry.weight
    if (cumulative >= total / 2) return entry.value
  }
  return entries[entries.length - 1]?.value ?? Number.NaN
}

function weightedMean(values: readonly number[], weights: readonly number[]): number {
  let numerator = 0
  let denominator = 0
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index]
    const weight = weights[index]
    if (value === undefined || weight === undefined || !Number.isFinite(value) || !Number.isFinite(weight) || weight <= 0) continue
    numerator += value * weight
    denominator += weight
  }
  return denominator > 0 ? numerator / denominator : Number.NaN
}

function weightedMeanNullable(
  values: readonly (number | null)[],
  weights: readonly number[],
): number | null {
  let numerator = 0
  let denominator = 0
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index]
    const weight = weights[index]
    if (value === null || value === undefined || weight === undefined || !Number.isFinite(weight) || weight <= 0) continue
    numerator += value * weight
    denominator += weight
  }
  return denominator > 0 ? numerator / denominator : null
}

function weightedStdev(
  values: readonly number[],
  weights: readonly number[],
  center: number,
): number {
  const variance = weightedMean(values.map((value) => (value - center) ** 2), weights)
  return Number.isFinite(variance) ? Math.sqrt(Math.max(0, variance)) : Number.POSITIVE_INFINITY
}

function aggregateBookWeights(observations: readonly MarketObservation[]): Map<string, number> {
  const totals = new Map<string, number>()
  for (const observation of observations) {
    totals.set(observation.bookmaker, (totals.get(observation.bookmaker) ?? 0) + observation.weight)
  }
  return totals
}

function calculateEffectiveBookCount(weights: readonly number[]): number {
  const total = weights.reduce((sum, value) => sum + value, 0)
  const squares = weights.reduce((sum, value) => sum + value * value, 0)
  return total > 0 && squares > 0 ? (total * total) / squares : 0
}

function huberLoss(value: number, delta: number): number {
  const absolute = Math.abs(value)
  return absolute <= delta ? 0.5 * value * value : delta * (absolute - 0.5 * delta)
}

function logit(probability: number): number {
  const p = clamp(probability, PROBABILITY_EPSILON, 1 - PROBABILITY_EPSILON)
  return Math.log(p / (1 - p))
}

function erf(value: number): number {
  const sign = value < 0 ? -1 : 1
  const x = Math.abs(value)
  const t = 1 / (1 + 0.3275911 * x)
  const coefficients = [0.254829592, -0.284496736, 1.421413741, -1.453152027, 1.061405429]
  const polynomial = (((((coefficients[4]! * t + coefficients[3]!) * t) + coefficients[2]!) * t + coefficients[1]!) * t + coefficients[0]!) * t
  return sign * (1 - polynomial * Math.exp(-x * x))
}

function compareToZero(value: number): BetStatus {
  if (Math.abs(value) <= EPSILON) return "push"
  return value > 0 ? "win" : "loss"
}

function integerValuesStrictlyBetween(lower: number, upper: number): number[] {
  const first = Math.floor(lower) + 1
  const last = Math.ceil(upper) - 1
  if (first > last) return []
  const count = last - first + 1
  if (count > 500) return []
  return Array.from({ length: count }, (_, index) => first + index)
}

function formatWindowLabel(
  market: MiddleMarket,
  landingValues: readonly number[],
  referenceOutcome?: string,
): string {
  if (landingValues.length === 0) return "No both-win landing result"
  if (market === "totals") {
    return landingValues.length === 1
      ? `Total ${landingValues[0]}`
      : `Total ${landingValues[0]}-${landingValues[landingValues.length - 1]}`
  }
  const first = landingValues[0]!
  const last = landingValues[landingValues.length - 1]!
  const team = referenceOutcome ?? "Reference side"
  if (landingValues.length === 1) {
    if (first === 0) return `${team} tie`
    return first > 0 ? `${team} wins by ${first}` : `${team} loses by ${Math.abs(first)}`
  }
  return `${team} margin ${first} to ${last}`
}

function keyNumbersForSport(
  sportKey: string,
  values: readonly number[],
  market: MiddleMarket,
): number[] {
  if (market !== "spreads") return []
  const configured = KEY_NUMBERS[sportKey] ?? []
  return values.filter((value) => configured.includes(Math.abs(value)))
}

function dedupeCandidates(candidates: readonly MiddleOpportunity[]): MiddleOpportunity[] {
  const byKey = new Map<string, MiddleOpportunity>()
  for (const candidate of candidates) {
    const [a, b] = candidate.legs
    const key = [
      candidate.market,
      normalizeBook(a.quote.bookmaker),
      normalizeOutcome(a.quote.outcome),
      pointKey(a.quote.point),
      normalizeBook(b.quote.bookmaker),
      normalizeOutcome(b.quote.outcome),
      pointKey(b.quote.point),
    ].join("|")
    const current = byKey.get(key)
    if (!current || compareMiddleOpportunities(candidate, current) < 0) byKey.set(key, candidate)
  }
  return [...byKey.values()]
}

function bestUniqueQuotes(quotes: readonly PointOutcomeQuote[]): PointOutcomeQuote[] {
  const byBookAndPoint = new Map<string, PointOutcomeQuote>()
  for (const quote of quotes) {
    const key = `${normalizeBook(quote.bookmaker)}|${pointKey(quote.point)}`
    const current = byBookAndPoint.get(key)
    if (!current || quotePreference(quote, current) < 0) byBookAndPoint.set(key, quote)
  }
  return [...byBookAndPoint.values()]
}

function pairPreference(
  left: readonly [PointOutcomeQuote, PointOutcomeQuote],
  right: readonly [PointOutcomeQuote, PointOutcomeQuote],
): number {
  const leftHold = Math.abs(1 / left[0].decimal + 1 / left[1].decimal - 1)
  const rightHold = Math.abs(1 / right[0].decimal + 1 / right[1].decimal - 1)
  if (Math.abs(leftHold - rightHold) > EPSILON) return leftHold - rightHold
  const leftOldest = Math.min(parseMillis(left[0].lastUpdate), parseMillis(left[1].lastUpdate))
  const rightOldest = Math.min(parseMillis(right[0].lastUpdate), parseMillis(right[1].lastUpdate))
  if (leftOldest !== rightOldest) return rightOldest - leftOldest
  return (right[0].decimal + right[1].decimal) - (left[0].decimal + left[1].decimal)
}

function quotePreference(left: PointOutcomeQuote, right: PointOutcomeQuote): number {
  if (Math.abs(left.decimal - right.decimal) > EPSILON) return right.decimal - left.decimal
  const leftTime = parseMillis(left.lastUpdate)
  const rightTime = parseMillis(right.lastUpdate)
  if (leftTime !== rightTime) return rightTime - leftTime
  return compareText(normalizeOutcome(left.outcome), normalizeOutcome(right.outcome))
}

function compareMiddleOpportunities(left: MiddleOpportunity, right: MiddleOpportunity): number {
  if (left.status !== right.status) return left.status === "actionable" ? -1 : 1
  if (Math.abs(left.conservativeEv - right.conservativeEv) > EPSILON) {
    return right.conservativeEv - left.conservativeEv
  }
  if (Math.abs(left.conservativeMiddleProbability - right.conservativeMiddleProbability) > EPSILON) {
    return right.conservativeMiddleProbability - left.conservativeMiddleProbability
  }
  if (left.confidence !== right.confidence) return right.confidence - left.confidence
  return left.windowLabel.localeCompare(right.windowLabel)
}

function maximumQuoteAgeSeconds(
  quotes: readonly PointOutcomeQuote[],
  asOfMs: number,
): number | null {
  const ages = quotes.map((quote) => quoteAgeSeconds(quote.lastUpdate, asOfMs))
  if (ages.some((age) => age === null)) return null
  return Math.max(...(ages as number[]))
}

function quoteAgeSeconds(lastUpdate: string | undefined, asOfMs: number): number | null {
  if (!lastUpdate) return null
  const timestamp = Date.parse(lastUpdate)
  if (!Number.isFinite(timestamp)) return null
  return (asOfMs - timestamp) / 1000
}

function parseMillis(value: string | undefined): number {
  if (!value) return Number.NEGATIVE_INFINITY
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY
}

function stripInternalDistribution(distribution: FittedDistribution): MiddleDistributionEstimate {
  const { jackknifeModels: _jackknifeModels, ...publicDistribution } = distribution
  return publicDistribution
}

function dedupeModels(models: readonly { mean: number; sigma: number }[]): Array<{ mean: number; sigma: number }> {
  const map = new Map<string, { mean: number; sigma: number }>()
  for (const model of models) {
    if (!Number.isFinite(model.mean) || !Number.isFinite(model.sigma) || model.sigma <= 0) continue
    map.set(`${model.mean.toFixed(6)}|${model.sigma.toFixed(6)}`, model)
  }
  return [...map.values()]
}

function pointKey(value: number): string {
  return String(Math.round(value * 10_000) / 10_000)
}

function normalizeBook(bookmaker: string): string {
  return bookmaker.trim().toLowerCase()
}

function normalizeOutcome(outcome: string): string {
  return outcome.trim().toLowerCase().replace(/\s+/g, " ")
}

function sameOutcome(a: string, b: string): boolean {
  return normalizeOutcome(a) === normalizeOutcome(b)
}

function isValidDecimal(decimal: number): boolean {
  return Number.isFinite(decimal) && decimal > 1 && decimal <= 1_001
}

function isIntegerLine(value: number): boolean {
  return Math.abs(value - Math.round(value)) <= EPSILON
}

function positiveOr(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) && (value ?? 0) > 0 ? value! : fallback
}

function nonNegativeOr(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) && (value ?? 0) >= 0 ? value! : fallback
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function compareScore(left: readonly number[], right: readonly number[]): number {
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0)
    if (Math.abs(difference) > EPSILON) return difference > 0 ? 1 : -1
  }
  return 0
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)]
}

/**
 * Starting priors only. Market-ladder fitting and held-out settlement
 * calibration should replace these as Mandarin's own dataset grows.
 */
export const SPORT_PRIORS: Readonly<Record<string, MiddleModelPrior>> = {
  americanfootball_nfl: { spreadSigma: 13.8, totalSigma: 13.5, meanUncertaintyFloor: 0.75 },
  americanfootball_ncaaf: { spreadSigma: 16, totalSigma: 16, meanUncertaintyFloor: 1 },
  basketball_nba: { spreadSigma: 12, totalSigma: 18, meanUncertaintyFloor: 0.75 },
  basketball_wnba: { spreadSigma: 12.5, totalSigma: 16.5, meanUncertaintyFloor: 0.75 },
  basketball_ncaab: { spreadSigma: 13, totalSigma: 17, meanUncertaintyFloor: 0.9 },
  baseball_mlb: { spreadSigma: 3.7, totalSigma: 3.1, meanUncertaintyFloor: 0.3 },
  icehockey_nhl: { spreadSigma: 2.3, totalSigma: 2.25, meanUncertaintyFloor: 0.25 },
  soccer_usa_mls: { spreadSigma: 1.75, totalSigma: 1.9, meanUncertaintyFloor: 0.2 },
  soccer_epl: { spreadSigma: 1.7, totalSigma: 1.85, meanUncertaintyFloor: 0.2 },
}

const KEY_NUMBERS: Readonly<Record<string, readonly number[]>> = {
  americanfootball_nfl: [3, 7, 10, 14],
  americanfootball_ncaaf: [3, 7, 10, 14],
  baseball_mlb: [1, 2],
  icehockey_nhl: [1, 2],
  soccer_usa_mls: [1, 2],
  soccer_epl: [1, 2],
}
