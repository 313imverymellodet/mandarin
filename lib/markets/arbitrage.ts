import type { RiskLevel } from "./types"

const EPSILON = 1e-12
const DEFAULT_MAX_DECIMAL = 1_001

/** Convert decimal odds (for example 2.10) to implied probability percent. */
export function decimalToImpliedPct(decimal: number): number {
  if (!Number.isFinite(decimal) || decimal <= 1) return 100
  return 100 / decimal
}

/** Convert valid non-zero American odds to decimal odds. Invalid input returns 1. */
export function americanToDecimal(american: number): number {
  if (!Number.isFinite(american) || american === 0) return 1
  return american > 0 ? american / 100 + 1 : 100 / Math.abs(american) + 1
}

/** Convert valid decimal odds to American odds. Invalid input returns 0. */
export function decimalToAmerican(decimal: number): number {
  if (!Number.isFinite(decimal) || decimal <= 1) return 0
  return decimal >= 2
    ? Math.round((decimal - 1) * 100)
    : Math.round(-100 / (decimal - 1))
}

export type QuoteMarket = "h2h" | "spreads" | "totals"

export interface OutcomeQuote {
  outcome: string
  bookmaker: string
  decimal: number
  lastUpdate?: string
  /** Optional market identity. Supplying it prevents alternate lines being mixed. */
  market?: QuoteMarket
  /** Required for safe spread/total grouping when alternate lines are present. */
  point?: number
}

export interface ArbitrageOptions {
  /** Optional explicit market. Otherwise it is inferred from quote metadata. */
  market?: QuoteMarket
  /** Deterministic evaluation time. Required when freshness gates are enabled. */
  asOf?: string
  requireQuoteTimestamps?: boolean
  maxQuoteAgeSeconds?: number
  maxQuoteSkewSeconds?: number
  maxFutureQuoteSkewSeconds?: number
  /** True by default for actionable arbitrage. */
  requireDistinctBookmakers?: boolean
  /** Minimum precise arbitrage edge, expressed as percentage points. */
  minimumEdgePct?: number
  /** Reject implausibly large decimal prices, often caused by feed errors. */
  maximumDecimal?: number
  /** Optional decimal-odds haircut applied before the edge gate. */
  decimalHaircutFraction?: number
}

export interface ArbResult {
  legs: OutcomeQuote[]
  /** 100 minus the sum of the selected legs' implied probability percentages. */
  edgePct: number
  impliedProbabilitySum: number
  /** Guaranteed return multiple before currency rounding: 1 / impliedProbabilitySum. */
  guaranteedReturnMultiple: number
  /** Theoretical ROI on total stake, distinct from edgePct. */
  guaranteedRoiPct: number
  market: QuoteMarket
  lineKey: string
  quoteSkewSeconds: number | null
  oldestQuoteAgeSeconds: number | null
  stressedEdgePct: number
}

export interface ArbitrageStakeLeg {
  quote: OutcomeQuote
  /** Actual rounded allocation divided by total stake. */
  stakeFraction: number
  /** Continuous equal-return fraction before currency rounding. */
  idealStakeFraction: number
  stake: number
  /** Conservative payout rounded down to the requested currency precision. */
  grossReturn: number
  netProfitIfWins: number
  /** Minimum price needed for this fixed allocation to avoid a loss. */
  breakEvenDecimal: number
  /** Minimum price needed for this allocation to retain the requested ROI. */
  minimumDecimalForTargetRoi: number
  /** Current price cushion above the break-even decimal, as percentage points. */
  priceCushionPct: number
}

export interface ArbitrageStakePlan {
  totalStake: number
  impliedProbabilitySum: number
  theoreticalEdgePct: number
  theoreticalRoiPct: number
  legs: ArbitrageStakeLeg[]
  guaranteedGrossReturn: number
  guaranteedProfit: number
  guaranteedRoiPct: number
  /** Difference between continuous theoretical payout and executable payout. */
  roundingDrag: number
  /** Maximum difference between any two executable gross payouts. */
  payoutSpread: number
  currencyPrecision: number
  targetRoiPct: number
}

export interface ArbitrageExecutionCheck {
  executable: boolean
  preciseEdgePct: number
  stressedEdgePct: number
  quoteSkewSeconds: number | null
  oldestQuoteAgeSeconds: number | null
  reasons: Array<
    | "invalid_market"
    | "duplicate_bookmaker"
    | "missing_timestamp"
    | "future_timestamp"
    | "stale_quote"
    | "quote_skew_too_large"
    | "edge_below_threshold"
    | "stressed_edge_below_threshold"
  >
}

interface ResolvedArbitrageOptions {
  market?: QuoteMarket
  asOfMs: number | null
  requireQuoteTimestamps: boolean
  maxQuoteAgeSeconds: number
  maxQuoteSkewSeconds: number
  maxFutureQuoteSkewSeconds: number
  requireDistinctBookmakers: boolean
  minimumEdgePct: number
  maximumDecimal: number
  decimalHaircutFraction: number
}

interface NormalizedQuote extends OutcomeQuote {
  outcomeKey: string
  bookmakerKey: string
  updateMs: number | null
  marketKey: QuoteMarket
  lineKey: string
}

interface CandidateResult {
  result: ArbResult
  newestUpdateMs: number | null
}

/**
 * Pick the best executable price combination for a complete 2-way or 3-way
 * market. Unlike a simple per-outcome maximum, this enumerates combinations so
 * a stale or same-book top quote cannot hide a slightly lower, executable arb.
 * Alternate spreads/totals are kept in separate line groups.
 */
export function findBestLines(
  quotes: readonly OutcomeQuote[],
  options: ArbitrageOptions = {},
): ArbResult | null {
  const resolved = resolveOptions(options)
  const normalized = normalizeQuotes(quotes, resolved)
  if (normalized.length < 2) return null

  const byLine = new Map<string, NormalizedQuote[]>()
  for (const quote of normalized) {
    const current = byLine.get(quote.lineKey) ?? []
    current.push(quote)
    byLine.set(quote.lineKey, current)
  }

  let best: CandidateResult | null = null
  for (const lineQuotes of byLine.values()) {
    const candidate = bestCombinationForLine(lineQuotes, resolved)
    if (candidate === null) continue
    if (isBetterArbCandidate(candidate, best)) best = candidate
  }

  return best?.result ?? null
}

/**
 * Return the best lines only when both the current and haircut-stressed edge
 * clear the configured threshold. The comparison uses unrounded math.
 */
export function findBestArbitrage(
  quotes: readonly OutcomeQuote[],
  options: ArbitrageOptions = {},
): ArbResult | null {
  const resolved = resolveOptions(options)
  const result = findBestLines(quotes, options)
  if (result === null) return null
  if (result.edgePct <= EPSILON || result.stressedEdgePct <= EPSILON) return null
  if (result.edgePct + EPSILON < resolved.minimumEdgePct) return null
  if (result.stressedEdgePct + EPSILON < resolved.minimumEdgePct) return null
  return result
}

/**
 * Validate a preselected set of legs immediately before execution. This should
 * be called again after the user enters a bankroll because odds can move between
 * scan and bet placement.
 */
export function validateArbitrageExecution(
  legs: readonly OutcomeQuote[],
  options: ArbitrageOptions = {},
): ArbitrageExecutionCheck {
  const resolved = resolveOptions(options)
  const reasons: ArbitrageExecutionCheck["reasons"] = []
  const normalized = normalizeQuotes(legs, resolved)

  if (normalized.length !== legs.length || (normalized.length !== 2 && normalized.length !== 3)) {
    reasons.push("invalid_market")
  }

  const lineKeys = new Set(normalized.map((quote) => quote.lineKey))
  const outcomes = new Set(normalized.map((quote) => quote.outcomeKey))
  if (
    lineKeys.size !== 1 ||
    outcomes.size !== normalized.length ||
    !isValidMarketCombination(normalized)
  ) {
    reasons.push("invalid_market")
  }

  if (
    resolved.requireDistinctBookmakers &&
    new Set(normalized.map((quote) => quote.bookmakerKey)).size !== normalized.length
  ) {
    reasons.push("duplicate_bookmaker")
  }

  const timing = quoteTiming(normalized, resolved)
  reasons.push(...timing.reasons)

  const preciseEdgePct = calculateArbitrageEdgePct(normalized.map((quote) => quote.decimal))
  const stressedEdgePct = calculateArbitrageEdgePct(
    normalized.map((quote) => haircutDecimal(quote.decimal, resolved.decimalHaircutFraction)),
  )
  if (preciseEdgePct + EPSILON < resolved.minimumEdgePct) reasons.push("edge_below_threshold")
  if (stressedEdgePct + EPSILON < resolved.minimumEdgePct) {
    reasons.push("stressed_edge_below_threshold")
  }

  return {
    executable: reasons.length === 0,
    preciseEdgePct,
    stressedEdgePct,
    quoteSkewSeconds: timing.quoteSkewSeconds,
    oldestQuoteAgeSeconds: timing.oldestQuoteAgeSeconds,
    reasons: unique(reasons),
  }
}

/**
 * Calculate 100 × (1 - sum(1 / decimal)). Positive values indicate arbitrage.
 * Invalid odds return negative infinity so they can never pass a threshold.
 */
export function calculateArbitrageEdgePct(decimalOdds: readonly number[]): number {
  if (decimalOdds.length !== 2 && decimalOdds.length !== 3) return Number.NEGATIVE_INFINITY
  if (decimalOdds.some((decimal) => !isValidDecimal(decimal, DEFAULT_MAX_DECIMAL))) {
    return Number.NEGATIVE_INFINITY
  }
  const impliedSum = decimalOdds.reduce((sum, decimal) => sum + 1 / decimal, 0)
  return Number.isFinite(impliedSum) ? (1 - impliedSum) * 100 : Number.NEGATIVE_INFINITY
}

/**
 * Equal-payout bankroll fractions for a two-way or three-way market. Invalid
 * legs return an empty array rather than throwing.
 */
export function stakeSplit(legs: readonly OutcomeQuote[]): number[] {
  if (legs.length !== 2 && legs.length !== 3) return []
  if (legs.some((leg) => !isValidDecimal(leg.decimal, DEFAULT_MAX_DECIMAL))) return []

  const inverse = legs.map((leg) => 1 / leg.decimal)
  const total = inverse.reduce((sum, value) => sum + value, 0)
  if (!Number.isFinite(total) || total <= 0) return []
  return inverse.map((value) => value / total)
}

/**
 * Build an execution-ready maximin staking plan. Integer currency units are
 * allocated to maximize the worst conservative payout, rather than merely
 * applying largest-remainder rounding to continuous Kelly-like fractions.
 */
export function buildArbitrageStakePlan(
  legs: readonly OutcomeQuote[],
  totalStake: number,
  currencyPrecision = 2,
  targetRoiPct = 0,
): ArbitrageStakePlan | null {
  if (!Number.isFinite(totalStake) || totalStake <= 0) return null
  if (!Number.isInteger(currencyPrecision) || currencyPrecision < 0 || currencyPrecision > 6) {
    return null
  }
  if (!Number.isFinite(targetRoiPct) || targetRoiPct < 0 || targetRoiPct > 10_000) return null

  // Do not produce an attractive-looking allocation for a malformed or
  // non-arbitrage set of legs. Timestamp checks belong to the later execution
  // revalidation call, but market identity and positive edge are mandatory.
  const structureCheck = validateArbitrageExecution(legs, {
    requireQuoteTimestamps: false,
    requireDistinctBookmakers: true,
    minimumEdgePct: 0,
    decimalHaircutFraction: 0,
  })
  if (!structureCheck.executable) return null
  // An exact break-even hedge is not arbitrage, even though a zero threshold
  // would otherwise pass the generic execution validator.
  if (
    structureCheck.preciseEdgePct <= EPSILON ||
    structureCheck.stressedEdgePct <= EPSILON
  ) {
    return null
  }

  const idealFractions = stakeSplit(legs)
  if (idealFractions.length !== legs.length) return null

  const unitScale = 10 ** currencyPrecision
  const totalUnits = Math.round(totalStake * unitScale)
  if (!Number.isSafeInteger(totalUnits) || totalUnits < legs.length) return null

  const allocatedUnits = optimizeStakeUnits(
    legs.map((leg) => leg.decimal),
    totalUnits,
    unitScale,
  )
  if (allocatedUnits === null) return null

  const roundedTotalStake = totalUnits / unitScale
  const targetRoi = targetRoiPct / 100
  const planLegs: ArbitrageStakeLeg[] = legs.map((quote, index) => {
    const units = allocatedUnits[index] ?? 0
    const stake = units / unitScale
    const grossReturn = floorCurrency(stake * quote.decimal, currencyPrecision)
    const breakEvenDecimal = stake > 0 ? roundedTotalStake / stake : Number.POSITIVE_INFINITY
    const minimumDecimalForTargetRoi = stake > 0
      ? (roundedTotalStake * (1 + targetRoi)) / stake
      : Number.POSITIVE_INFINITY

    return {
      quote,
      stakeFraction: stake / roundedTotalStake,
      idealStakeFraction: idealFractions[index] ?? 0,
      stake,
      grossReturn,
      netProfitIfWins: roundCurrency(grossReturn - roundedTotalStake, currencyPrecision),
      breakEvenDecimal,
      minimumDecimalForTargetRoi,
      priceCushionPct: Number.isFinite(breakEvenDecimal)
        ? ((quote.decimal / breakEvenDecimal) - 1) * 100
        : Number.NEGATIVE_INFINITY,
    }
  })

  const grossReturns = planLegs.map((leg) => leg.grossReturn)
  const guaranteedGrossReturn = Math.min(...grossReturns)
  const guaranteedProfit = roundCurrency(guaranteedGrossReturn - roundedTotalStake, currencyPrecision)
  // A theoretical arb can become non-executable at a small bankroll after
  // sportsbook/currency rounding. Do not surface a plan that guarantees no
  // positive currency profit. The caller can ask the user for a larger stake.
  if (guaranteedProfit <= 0) return null

  const impliedProbabilitySum = legs.reduce((sum, leg) => sum + 1 / leg.decimal, 0)
  const theoreticalGrossReturn = roundedTotalStake / impliedProbabilitySum

  return {
    totalStake: roundedTotalStake,
    impliedProbabilitySum,
    theoreticalEdgePct: (1 - impliedProbabilitySum) * 100,
    theoreticalRoiPct: ((1 / impliedProbabilitySum) - 1) * 100,
    legs: planLegs,
    guaranteedGrossReturn,
    guaranteedProfit,
    guaranteedRoiPct: (guaranteedProfit / roundedTotalStake) * 100,
    roundingDrag: roundCurrency(
      Math.max(0, theoreticalGrossReturn - guaranteedGrossReturn),
      currencyPrecision,
    ),
    payoutSpread: roundCurrency(Math.max(...grossReturns) - Math.min(...grossReturns), currencyPrecision),
    currencyPrecision,
    targetRoiPct,
  }
}

/**
 * Execution-risk heuristic. Large apparent arbs and near-start events are more
 * likely to move, suspend, limit, or fail before all legs are accepted.
 */
export function riskForEdge(edgePct: number, hoursUntilEvent: number): RiskLevel {
  if (!Number.isFinite(edgePct) || !Number.isFinite(hoursUntilEvent)) return "high"
  if (edgePct >= 5 || hoursUntilEvent < 1) return "high"
  if (edgePct >= 2 || hoursUntilEvent < 6) return "medium"
  return "low"
}

function bestCombinationForLine(
  quotes: readonly NormalizedQuote[],
  options: ResolvedArbitrageOptions,
): CandidateResult | null {
  const byOutcome = new Map<string, NormalizedQuote[]>()
  for (const quote of quotes) {
    const current = byOutcome.get(quote.outcomeKey) ?? []
    current.push(quote)
    byOutcome.set(quote.outcomeKey, current)
  }

  const outcomeKeys = [...byOutcome.keys()].sort(compareText)
  if (outcomeKeys.length !== 2 && outcomeKeys.length !== 3) return null

  const quoteLists = outcomeKeys.map((key) => {
    const list = byOutcome.get(key) ?? []
    return list.sort(compareQuotePreference)
  })
  if (quoteLists.some((list) => list.length === 0)) return null

  let best: CandidateResult | null = null
  enumerateCombinations(quoteLists, 0, [], (combination) => {
    if (
      options.requireDistinctBookmakers &&
      new Set(combination.map((quote) => quote.bookmakerKey)).size !== combination.length
    ) {
      return
    }
    if (!isValidMarketCombination(combination)) return

    const timing = quoteTiming(combination, options)
    if (timing.reasons.length > 0) return

    const impliedProbabilitySum = combination.reduce((sum, quote) => sum + 1 / quote.decimal, 0)
    if (!Number.isFinite(impliedProbabilitySum) || impliedProbabilitySum <= 0) return
    const edgePct = (1 - impliedProbabilitySum) * 100
    const stressedDecimals = combination.map((quote) =>
      haircutDecimal(quote.decimal, options.decimalHaircutFraction),
    )
    const stressedEdgePct = calculateArbitrageEdgePct(stressedDecimals)
    const market = combination[0]?.marketKey
    const lineKey = combination[0]?.lineKey
    if (market === undefined || lineKey === undefined) return

    const result: ArbResult = {
      legs: combination.map(stripNormalizedFields),
      edgePct,
      impliedProbabilitySum,
      guaranteedReturnMultiple: 1 / impliedProbabilitySum,
      guaranteedRoiPct: ((1 / impliedProbabilitySum) - 1) * 100,
      market,
      lineKey,
      quoteSkewSeconds: timing.quoteSkewSeconds,
      oldestQuoteAgeSeconds: timing.oldestQuoteAgeSeconds,
      stressedEdgePct,
    }
    const newestUpdateMs = newestTimestamp(combination)
    const candidate = { result, newestUpdateMs }
    if (isBetterArbCandidate(candidate, best)) best = candidate
  })

  return best
}

function normalizeQuotes(
  quotes: readonly OutcomeQuote[],
  options: ResolvedArbitrageOptions,
): NormalizedQuote[] {
  const normalized: NormalizedQuote[] = []

  for (const quote of quotes) {
    if (typeof quote.outcome !== "string" || typeof quote.bookmaker !== "string") continue
    const outcome = quote.outcome.trim()
    const bookmaker = quote.bookmaker.trim()
    const outcomeKey = normalizeKey(outcome)
    const bookmakerKey = normalizeKey(bookmaker)
    if (!outcomeKey || !bookmakerKey) continue
    if (!isValidDecimal(quote.decimal, options.maximumDecimal)) continue

    const marketKey = inferMarket(quote, options.market)
    if (marketKey === null) continue
    const lineKey = buildLineKey(quote, marketKey)
    if (lineKey === null) continue
    const updateMs = parseIsoMillis(quote.lastUpdate)

    normalized.push({
      ...quote,
      outcome,
      bookmaker,
      outcomeKey,
      bookmakerKey,
      updateMs,
      marketKey,
      lineKey,
    })
  }

  // Deduplicate provider repeats deterministically by market/line/outcome/book.
  const deduped = new Map<string, NormalizedQuote>()
  for (const quote of normalized) {
    const key = `${quote.lineKey}|${quote.outcomeKey}|${quote.bookmakerKey}`
    const current = deduped.get(key)
    if (current === undefined || compareQuotePreferenceForDedup(quote, current, options) < 0) {
      deduped.set(key, quote)
    }
  }

  return [...deduped.values()]
}

function quoteTiming(
  quotes: readonly NormalizedQuote[],
  options: ResolvedArbitrageOptions,
): {
  quoteSkewSeconds: number | null
  oldestQuoteAgeSeconds: number | null
  reasons: ArbitrageExecutionCheck["reasons"]
} {
  const reasons: ArbitrageExecutionCheck["reasons"] = []
  if (options.asOfMs === null) {
    if (options.requireQuoteTimestamps) reasons.push("missing_timestamp")
    return { quoteSkewSeconds: null, oldestQuoteAgeSeconds: null, reasons }
  }

  const timestamps = quotes.map((quote) => quote.updateMs)
  if (timestamps.some((timestamp) => timestamp === null)) {
    if (options.requireQuoteTimestamps) reasons.push("missing_timestamp")
    return { quoteSkewSeconds: null, oldestQuoteAgeSeconds: null, reasons }
  }

  const times = timestamps as number[]
  const newest = Math.max(...times)
  const oldest = Math.min(...times)
  const quoteSkewSeconds = (newest - oldest) / 1000
  const ages = times.map((time) => (options.asOfMs! - time) / 1000)
  const oldestQuoteAgeSeconds = Math.max(...ages)
  const mostFutureSeconds = Math.max(0, -Math.min(...ages))

  if (mostFutureSeconds > options.maxFutureQuoteSkewSeconds) reasons.push("future_timestamp")
  if (oldestQuoteAgeSeconds > options.maxQuoteAgeSeconds) reasons.push("stale_quote")
  if (quoteSkewSeconds > options.maxQuoteSkewSeconds) reasons.push("quote_skew_too_large")

  return { quoteSkewSeconds, oldestQuoteAgeSeconds, reasons }
}

function inferMarket(quote: OutcomeQuote, explicit: QuoteMarket | undefined): QuoteMarket | null {
  if (explicit !== undefined) {
    if (quote.market !== undefined && quote.market !== explicit) return null
    return explicit
  }
  if (quote.market !== undefined) return quote.market
  const outcome = normalizeKey(quote.outcome)
  if (quote.point !== undefined) return outcome === "over" || outcome === "under" ? "totals" : "spreads"
  return "h2h"
}

function buildLineKey(quote: OutcomeQuote, market: QuoteMarket): string | null {
  if (market === "h2h") return "h2h"
  if (!Number.isFinite(quote.point)) return null
  const numericPoint = quote.point!
  const point = normalizePoint(numericPoint)
  if (market === "totals") return `totals:${point}`
  return `spreads:${normalizePoint(Math.abs(numericPoint))}`
}

function isValidMarketCombination(quotes: readonly NormalizedQuote[]): boolean {
  if (quotes.length !== 2 && quotes.length !== 3) return false
  const market = quotes[0]?.marketKey
  if (market === undefined || quotes.some((quote) => quote.marketKey !== market)) return false

  if (market === "h2h") return true
  if (quotes.length !== 2) return false

  if (market === "totals") {
    const outcomes = new Set(quotes.map((quote) => quote.outcomeKey))
    if (outcomes.size !== 2 || !outcomes.has("over") || !outcomes.has("under")) return false
    const firstPoint = quotes[0]?.point
    const secondPoint = quotes[1]?.point
    return Number.isFinite(firstPoint) && Number.isFinite(secondPoint) &&
      Math.abs((firstPoint ?? 0) - (secondPoint ?? 0)) <= 1e-7
  }

  const firstPoint = quotes[0]?.point
  const secondPoint = quotes[1]?.point
  return Number.isFinite(firstPoint) && Number.isFinite(secondPoint) &&
    Math.abs((firstPoint ?? 0) + (secondPoint ?? 0)) <= 1e-7
}

function optimizeStakeUnits(
  decimals: readonly number[],
  totalUnits: number,
  unitScale: number,
): number[] | null {
  if (decimals.length !== 2 && decimals.length !== 3) return null
  if (decimals.some((decimal) => !isValidDecimal(decimal, DEFAULT_MAX_DECIMAL))) return null

  const impliedSum = decimals.reduce((sum, decimal) => sum + 1 / decimal, 0)
  const theoreticalGross = (totalUnits / unitScale) / impliedSum
  let low = 0
  let high = theoreticalGross

  for (let iteration = 0; iteration < 100; iteration += 1) {
    const midpoint = (low + high) / 2
    const required = decimals.map((decimal) =>
      Math.max(0, Math.ceil(((midpoint / decimal) * unitScale) - 1e-10)),
    )
    const requiredTotal = required.reduce((sum, units) => sum + units, 0)
    if (requiredTotal <= totalUnits) low = midpoint
    else high = midpoint
  }

  const units = decimals.map((decimal) =>
    Math.max(0, Math.ceil(((low / decimal) * unitScale) - 1e-8)),
  )
  let remaining = totalUnits - units.reduce((sum, value) => sum + value, 0)
  if (remaining < 0) {
    // Floating-point boundary fallback: remove units from the highest payout.
    while (remaining < 0) {
      const index = indexOfMaximum(units.map((value, i) => value * decimals[i]!))
      if (index < 0 || (units[index] ?? 0) <= 0) return null
      units[index] = (units[index] ?? 0) - 1
      remaining += 1
    }
  }

  while (remaining > 0) {
    let bestIndex = 0
    let bestScore: readonly number[] | null = null
    for (let index = 0; index < units.length; index += 1) {
      const candidate = [...units]
      candidate[index] = (candidate[index] ?? 0) + 1
      const score = allocationScore(candidate, decimals, unitScale)
      if (bestScore === null || compareScore(score, bestScore) > 0) {
        bestScore = score
        bestIndex = index
      }
    }
    units[bestIndex] = (units[bestIndex] ?? 0) + 1
    remaining -= 1
  }

  // Discrete coordinate ascent protects against any binary-search boundary
  // artifacts and optimizes the conservative currency-rounded payout spread.
  for (let iteration = 0; iteration < 10_000; iteration += 1) {
    const currentScore = allocationScore(units, decimals, unitScale)
    let bestMove: { from: number; to: number; score: readonly number[] } | null = null

    for (let from = 0; from < units.length; from += 1) {
      if ((units[from] ?? 0) <= 1) continue
      for (let to = 0; to < units.length; to += 1) {
        if (from === to) continue
        const candidate = [...units]
        candidate[from] = (candidate[from] ?? 0) - 1
        candidate[to] = (candidate[to] ?? 0) + 1
        const score = allocationScore(candidate, decimals, unitScale)
        if (compareScore(score, currentScore) <= 0) continue
        if (bestMove === null || compareScore(score, bestMove.score) > 0) {
          bestMove = { from, to, score }
        }
      }
    }

    if (bestMove === null) break
    units[bestMove.from] = (units[bestMove.from] ?? 0) - 1
    units[bestMove.to] = (units[bestMove.to] ?? 0) + 1
  }

  return units
}

function allocationScore(
  units: readonly number[],
  decimals: readonly number[],
  unitScale: number,
): readonly number[] {
  const payouts = units.map((value, index) =>
    Math.floor((value * decimals[index]!) + EPSILON) / unitScale,
  )
  const minimum = Math.min(...payouts)
  const spread = Math.max(...payouts) - minimum
  return [minimum, -spread]
}

function compareScore(left: readonly number[], right: readonly number[]): number {
  const length = Math.max(left.length, right.length)
  for (let index = 0; index < length; index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0)
    if (Math.abs(difference) > EPSILON) return difference > 0 ? 1 : -1
  }
  return 0
}

function enumerateCombinations<T>(
  lists: readonly (readonly T[])[],
  index: number,
  selected: T[],
  visit: (combination: readonly T[]) => void,
): void {
  if (index >= lists.length) {
    visit([...selected])
    return
  }
  const list = lists[index]
  if (list === undefined) return
  for (const value of list) {
    selected.push(value)
    enumerateCombinations(lists, index + 1, selected, visit)
    selected.pop()
  }
}

function resolveOptions(options: ArbitrageOptions): ResolvedArbitrageOptions {
  const parsedAsOf = parseIsoMillis(options.asOf)
  return {
    ...(options.market ? { market: options.market } : {}),
    asOfMs: parsedAsOf,
    requireQuoteTimestamps: options.requireQuoteTimestamps ?? false,
    maxQuoteAgeSeconds: nonNegative(options.maxQuoteAgeSeconds, 120),
    maxQuoteSkewSeconds: nonNegative(options.maxQuoteSkewSeconds, 45),
    maxFutureQuoteSkewSeconds: nonNegative(options.maxFutureQuoteSkewSeconds, 5),
    requireDistinctBookmakers: options.requireDistinctBookmakers ?? true,
    minimumEdgePct: nonNegative(options.minimumEdgePct, 0),
    maximumDecimal: positive(options.maximumDecimal, DEFAULT_MAX_DECIMAL),
    decimalHaircutFraction: clamp(nonNegative(options.decimalHaircutFraction, 0), 0, 0.25),
  }
}

function compareQuotePreferenceForDedup(
  left: NormalizedQuote,
  right: NormalizedQuote,
  options: ResolvedArbitrageOptions,
): number {
  const leftUsable = isQuoteIndividuallyUsable(left, options)
  const rightUsable = isQuoteIndividuallyUsable(right, options)
  if (leftUsable !== rightUsable) return leftUsable ? -1 : 1
  return compareQuotePreference(left, right)
}

function isQuoteIndividuallyUsable(
  quote: NormalizedQuote,
  options: ResolvedArbitrageOptions,
): boolean {
  if (options.asOfMs === null) return !options.requireQuoteTimestamps || quote.updateMs !== null
  if (quote.updateMs === null) return !options.requireQuoteTimestamps
  const ageSeconds = (options.asOfMs - quote.updateMs) / 1000
  return ageSeconds >= -options.maxFutureQuoteSkewSeconds &&
    ageSeconds <= options.maxQuoteAgeSeconds
}

function compareQuotePreference(left: NormalizedQuote, right: NormalizedQuote): number {
  if (Math.abs(left.decimal - right.decimal) > EPSILON) return right.decimal - left.decimal
  if (left.updateMs !== null && right.updateMs !== null && left.updateMs !== right.updateMs) {
    return right.updateMs - left.updateMs
  }
  if (left.updateMs !== null && right.updateMs === null) return -1
  if (left.updateMs === null && right.updateMs !== null) return 1
  const book = compareText(left.bookmakerKey, right.bookmakerKey)
  if (book !== 0) return book
  return compareText(left.outcomeKey, right.outcomeKey)
}

function isBetterArbCandidate(next: CandidateResult, current: CandidateResult | null): boolean {
  if (current === null) return true
  if (Math.abs(next.result.edgePct - current.result.edgePct) > EPSILON) {
    return next.result.edgePct > current.result.edgePct
  }
  if (Math.abs(next.result.stressedEdgePct - current.result.stressedEdgePct) > EPSILON) {
    return next.result.stressedEdgePct > current.result.stressedEdgePct
  }
  const nextAge = next.result.oldestQuoteAgeSeconds ?? Number.POSITIVE_INFINITY
  const currentAge = current.result.oldestQuoteAgeSeconds ?? Number.POSITIVE_INFINITY
  if (Math.abs(nextAge - currentAge) > EPSILON) return nextAge < currentAge
  const nextSkew = next.result.quoteSkewSeconds ?? Number.POSITIVE_INFINITY
  const currentSkew = current.result.quoteSkewSeconds ?? Number.POSITIVE_INFINITY
  if (Math.abs(nextSkew - currentSkew) > EPSILON) return nextSkew < currentSkew
  if (next.newestUpdateMs !== current.newestUpdateMs) {
    return (next.newestUpdateMs ?? Number.NEGATIVE_INFINITY) >
      (current.newestUpdateMs ?? Number.NEGATIVE_INFINITY)
  }
  return serializeLegs(next.result.legs) < serializeLegs(current.result.legs)
}

function stripNormalizedFields(quote: NormalizedQuote): OutcomeQuote {
  const { outcomeKey: _outcomeKey, bookmakerKey: _bookmakerKey, updateMs: _updateMs, marketKey: _marketKey, lineKey: _lineKey, ...clean } = quote
  return clean
}

function newestTimestamp(quotes: readonly NormalizedQuote[]): number | null {
  const values = quotes
    .map((quote) => quote.updateMs)
    .filter((value): value is number => value !== null)
  return values.length > 0 ? Math.max(...values) : null
}

function serializeLegs(legs: readonly OutcomeQuote[]): string {
  return legs
    .map((leg) => `${normalizeKey(leg.outcome)}:${normalizeKey(leg.bookmaker)}:${leg.decimal}`)
    .sort(compareText)
    .join("|")
}

function haircutDecimal(decimal: number, fraction: number): number {
  // Haircut only the profit component. A 1% haircut turns 2.00 into 1.99,
  // which is more realistic than multiplying the full gross decimal by 0.99.
  return 1 + (decimal - 1) * (1 - fraction)
}

function floorCurrency(value: number, precision: number): number {
  const scale = 10 ** precision
  return Math.floor((value + EPSILON) * scale) / scale
}

function roundCurrency(value: number, precision: number): number {
  const scale = 10 ** precision
  return Math.round((value + Number.EPSILON) * scale) / scale
}

function normalizePoint(value: number): string {
  const rounded = Math.round(value * 10_000) / 10_000
  return Object.is(rounded, -0) ? "0" : String(rounded)
}

function parseIsoMillis(value: string | undefined): number | null {
  if (!value) return null
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

function isValidDecimal(decimal: number, maximum: number): boolean {
  return Number.isFinite(decimal) && decimal > 1 && decimal <= maximum
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ")
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function indexOfMaximum(values: readonly number[]): number {
  if (values.length === 0) return -1
  let best = 0
  for (let index = 1; index < values.length; index += 1) {
    if ((values[index] ?? Number.NEGATIVE_INFINITY) > (values[best] ?? Number.NEGATIVE_INFINITY)) {
      best = index
    }
  }
  return best
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)]
}

function nonNegative(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) && (value ?? 0) >= 0 ? value! : fallback
}

function positive(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) && (value ?? 0) > 0 ? value! : fallback
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}
