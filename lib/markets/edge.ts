import type { OutcomeQuote } from "./arbitrage"

const EPSILON = 1e-12
const DEFAULT_SHARP_BOOKMAKERS = ["pinnacle"] as const

export type FairValueSource = "sharp" | "consensus"

export interface FairProbability {
  outcome: string
  probability: number
}

export interface FairValueAnchor {
  source: FairValueSource
  bookmaker?: string
  probabilities: FairProbability[]
  contributingBookmakers: string[]
  overround: number
}

export interface ConfidenceBreakdown {
  books: number
  agreement: number
  sharpAnchor: number
  timeToEvent: number
  meanProbabilityStdev: number | null
  timeToEventHours: number | null
}

export interface EvaluatedQuote {
  outcome: string
  bookmaker: string
  decimal: number
  fairProbability: number
  fairProbabilityPct: number
  ev: number
  evPct: number
  fullKellyFraction: number
  kellyStakeFraction: number
  kellyStakePct: number
  lastUpdate?: string
}

export interface EdgeOpportunity extends EvaluatedQuote {
  confidence: number
  confidenceBreakdown: ConfidenceBreakdown
  anchorSource: FairValueSource
  anchorBookmaker?: string
  booksQuoting: number
}

export interface EdgeAnalysis {
  anchor: FairValueAnchor
  evaluations: EvaluatedQuote[]
  best: EdgeOpportunity | null
  confidence: number
  confidenceBreakdown: ConfidenceBreakdown
  booksQuoting: number
}

export interface EdgeOptions {
  /** Ordered sharp-book preference. Defaults to Pinnacle. */
  sharpBookmakers?: readonly string[]
  /** Minimum complete books required when no sharp book is available. Defaults to 2. */
  minConsensusBooks?: number
  /** Only these books may be returned as the actionable best bet. All books still inform consensus. */
  eligibleBookmakers?: readonly string[]
  /** Minimum EV as a decimal fraction. Example: 0.01 means +1.00%. Defaults to 0. */
  minimumEv?: number
  /** Fraction of full Kelly to recommend. Defaults to 0.25 (quarter Kelly). */
  kellyFraction?: number
  /** Event start time as ISO-8601. Used only for confidence. */
  eventTime?: string
  /** Deterministic evaluation time as ISO-8601. Never defaults to Date.now(). */
  asOf?: string
  /** Complete-book count that earns the maximum book-depth score. Defaults to 6. */
  targetBookCount?: number
  /** Mean probability stdev that maps agreement to zero. Defaults to 0.08. */
  agreementStdevCeiling?: number
}

export interface PointOutcomeQuote extends OutcomeQuote {
  point: number
}

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

interface ResolvedEdgeOptions {
  sharpBookmakers: string[]
  minConsensusBooks: number
  eligibleBookmakers: Set<string> | null
  minimumEv: number
  kellyFraction: number
  eventTime?: string
  asOf?: string
  targetBookCount: number
  agreementStdevCeiling: number
}

interface BookFairValue {
  bookmaker: string
  probabilities: number[]
  overround: number
}

/**
 * Converts valid decimal odds to implied probability in the 0..1 range.
 * Returns null for non-finite odds or odds less than or equal to 1.00.
 */
export function decimalToImpliedProbability(decimal: number): number | null {
  return isValidDecimal(decimal) ? 1 / decimal : null
}

/**
 * Removes bookmaker margin from a complete two-way or three-way market by
 * proportionally normalizing raw implied probabilities so they sum to one.
 *
 * This is the proportional/multiplicative method. Shin and power methods are
 * useful alternatives when you want to model favorite-longshot bias, but they
 * require an additional parameter or numerical solve and are intentionally not
 * used in this dependency-free core.
 */
export function devigProportional(decimalOdds: readonly number[]): number[] | null {
  if (decimalOdds.length !== 2 && decimalOdds.length !== 3) return null

  const implied: number[] = []
  let total = 0

  for (const decimal of decimalOdds) {
    const probability = decimalToImpliedProbability(decimal)
    if (probability === null) return null
    implied.push(probability)
    total += probability
  }

  if (!Number.isFinite(total) || total <= EPSILON) return null
  return implied.map((probability) => probability / total)
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
 * The returned value is a bankroll fraction and is floored at zero.
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
 * Builds the fair-value anchor for a market. A complete configured sharp book
 * wins; otherwise at least two complete books are required for consensus.
 */
export function buildFairValueAnchor(
  quotes: readonly OutcomeQuote[],
  options: EdgeOptions = {},
): FairValueAnchor | null {
  const prepared = prepareMarket(quotes)
  if (prepared === null) return null
  return buildAnchorFromPrepared(prepared, resolveOptions(options))
}

/**
 * Evaluates every valid quote against one fair-value anchor and returns all EV
 * calculations plus the single best eligible positive-EV opportunity.
 */
export function analyzePositiveEV(
  quotes: readonly OutcomeQuote[],
  options: EdgeOptions = {},
): EdgeAnalysis | null {
  const prepared = prepareMarket(quotes)
  if (prepared === null) return null

  const resolved = resolveOptions(options)
  const anchor = buildAnchorFromPrepared(prepared, resolved)
  if (anchor === null) return null

  const fairByOutcome = new Map<string, number>()
  for (const fair of anchor.probabilities) {
    fairByOutcome.set(normalizeKey(fair.outcome), fair.probability)
  }

  const evaluations: EvaluatedQuote[] = []
  for (const quote of prepared.quotes) {
    const fairProbability = fairByOutcome.get(quote.outcomeKey)
    if (fairProbability === undefined) continue

    const ev = expectedValue(quote.decimal, fairProbability)
    if (ev === null) continue

    const fullKellyFraction = fractionalKellyStake(quote.decimal, fairProbability, 1)
    const kellyStakeFraction = fractionalKellyStake(
      quote.decimal,
      fairProbability,
      resolved.kellyFraction,
    )

    evaluations.push({
      outcome: prepared.outcomeLabels.get(quote.outcomeKey) ?? quote.outcome.trim(),
      bookmaker: quote.bookmakerKey,
      decimal: quote.decimal,
      fairProbability,
      fairProbabilityPct: fairProbability * 100,
      ev,
      evPct: ev * 100,
      fullKellyFraction,
      kellyStakeFraction,
      kellyStakePct: kellyStakeFraction * 100,
      ...(quote.lastUpdate ? { lastUpdate: quote.lastUpdate } : {}),
    })
  }

  evaluations.sort(compareEvaluatedQuotes)

  const completeBooks = getCompleteBookFairValues(prepared)
  const confidenceResult = calculateConfidence(
    completeBooks,
    anchor.source === "sharp",
    resolved,
  )

  const bestEvaluation = evaluations.find((evaluation) => {
    if (evaluation.ev <= resolved.minimumEv + EPSILON) return false
    return (
      resolved.eligibleBookmakers === null ||
      resolved.eligibleBookmakers.has(normalizeKey(evaluation.bookmaker))
    )
  })

  const best: EdgeOpportunity | null = bestEvaluation
    ? {
        ...bestEvaluation,
        confidence: confidenceResult.score,
        confidenceBreakdown: confidenceResult.breakdown,
        anchorSource: anchor.source,
        ...(anchor.bookmaker ? { anchorBookmaker: anchor.bookmaker } : {}),
        booksQuoting: completeBooks.length,
      }
    : null

  return {
    anchor,
    evaluations,
    best,
    confidence: confidenceResult.score,
    confidenceBreakdown: confidenceResult.breakdown,
    booksQuoting: completeBooks.length,
  }
}

/**
 * Convenience wrapper that returns only the best eligible positive-EV bet.
 */
export function findBestPositiveEV(
  quotes: readonly OutcomeQuote[],
  options: EdgeOptions = {},
): EdgeOpportunity | null {
  return analyzePositiveEV(quotes, options)?.best ?? null
}

/**
 * Finds the widest two-sided spread middle across different bookmakers.
 * For outcome A versus outcome B, both bets win when:
 *   -A.point < score(A) - score(B) < B.point
 * Boundary scores can produce pushes on integer lines.
 */
export function findBestSpreadMiddle(
  quotes: readonly PointOutcomeQuote[],
): MiddleOpportunity | null {
  const valid = normalizePointQuotes(quotes)
  const outcomeKeys = [...new Set(valid.map((quote) => normalizeKey(quote.outcome)))].sort()
  if (outcomeKeys.length !== 2) return null

  const first = valid.filter((quote) => normalizeKey(quote.outcome) === outcomeKeys[0])
  const second = valid.filter((quote) => normalizeKey(quote.outcome) === outcomeKeys[1])
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
        marginOutcome: firstLeg.outcome,
      }

      if (isBetterMiddle(candidate, best)) best = candidate
    }
  }

  return best
}

/**
 * Finds the widest totals middle across different bookmakers: an Over at the
 * lower total and an Under at the higher total. Boundary totals can push.
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

/** Returns true when decimal odds are finite and strictly greater than 1.00. */
function isValidDecimal(decimal: number): boolean {
  return Number.isFinite(decimal) && decimal > 1
}

/** Returns true when a probability is finite and lies in the closed 0..1 interval. */
function isProbability(probability: number): boolean {
  return Number.isFinite(probability) && probability >= 0 && probability <= 1
}

/** Normalizes bookmaker and outcome identifiers for deterministic matching. */
function normalizeKey(value: string): string {
  return value.trim().toLowerCase()
}

/** Compares strings by UTF-16 code units so sorting is locale-independent. */
function compareText(left: string, right: string): number {
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

/** Converts an ISO date string to epoch milliseconds, returning null if invalid. */
function parseIsoMillis(value: string | undefined): number | null {
  if (!value) return null
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
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

/** Cleans, normalizes, deduplicates, and validates one event's 2-way or 3-way quotes. */
function prepareMarket(quotes: readonly OutcomeQuote[]): PreparedMarket | null {
  const outcomeLabels = new Map<string, string>()
  const books = new Map<string, PreparedBook>()

  for (const quote of quotes) {
    if (!isValidDecimal(quote.decimal)) continue
    if (typeof quote.outcome !== "string" || typeof quote.bookmaker !== "string") continue

    const outcome = quote.outcome.trim()
    const bookmaker = quote.bookmaker.trim()
    const outcomeKey = normalizeKey(outcome)
    const bookmakerKey = normalizeKey(bookmaker)
    if (!outcomeKey || !bookmakerKey) continue

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

  const outcomeKeys = [...outcomeLabels.keys()].sort()
  if (outcomeKeys.length !== 2 && outcomeKeys.length !== 3) return null

  const normalizedQuotes: NormalizedQuote[] = []
  for (const bookmakerKey of [...books.keys()].sort()) {
    const book = books.get(bookmakerKey)
    if (book === undefined) continue
    const isComplete = outcomeKeys.every((outcomeKey) => book.outcomes.has(outcomeKey))
    if (!isComplete) continue
    for (const outcomeKey of outcomeKeys) {
      const quote = book.outcomes.get(outcomeKey)
      if (quote !== undefined) normalizedQuotes.push(quote)
    }
  }

  if (normalizedQuotes.length === 0) return null
  return { outcomeKeys, outcomeLabels, books, quotes: normalizedQuotes }
}

/** Resolves and bounds optional heuristics without using ambient time or mutable state. */
function resolveOptions(options: EdgeOptions): ResolvedEdgeOptions {
  const sharpSource = options.sharpBookmakers ?? DEFAULT_SHARP_BOOKMAKERS
  const sharpBookmakers = [...new Set(sharpSource.map(normalizeKey).filter(Boolean))]

  const eligibleBookmakers = options.eligibleBookmakers
    ? new Set(options.eligibleBookmakers.map(normalizeKey).filter(Boolean))
    : null

  const minConsensusBooks = Number.isFinite(options.minConsensusBooks)
    ? Math.max(2, Math.floor(options.minConsensusBooks ?? 2))
    : 2
  const minimumEv = Number.isFinite(options.minimumEv)
    ? Math.max(0, options.minimumEv ?? 0)
    : 0
  const kellyFraction = Number.isFinite(options.kellyFraction)
    ? Math.max(0, options.kellyFraction ?? 0.25)
    : 0.25
  const targetBookCount = Number.isFinite(options.targetBookCount)
    ? Math.max(1, Math.floor(options.targetBookCount ?? 6))
    : 6
  const agreementStdevCeiling =
    Number.isFinite(options.agreementStdevCeiling) && (options.agreementStdevCeiling ?? 0) > 0
      ? (options.agreementStdevCeiling ?? 0.08)
      : 0.08

  return {
    sharpBookmakers,
    minConsensusBooks,
    eligibleBookmakers,
    minimumEv,
    kellyFraction,
    ...(options.eventTime ? { eventTime: options.eventTime } : {}),
    ...(options.asOf ? { asOf: options.asOf } : {}),
    targetBookCount,
    agreementStdevCeiling,
  }
}

/** Converts one complete book into a de-vigged probability vector. */
function getBookFairValue(
  book: PreparedBook,
  outcomeKeys: readonly string[],
): BookFairValue | null {
  const decimals: number[] = []
  let overround = 0

  for (const outcomeKey of outcomeKeys) {
    const quote = book.outcomes.get(outcomeKey)
    if (quote === undefined) return null
    decimals.push(quote.decimal)
    overround += 1 / quote.decimal
  }

  const probabilities = devigProportional(decimals)
  if (probabilities === null || !Number.isFinite(overround) || overround <= EPSILON) return null
  return { bookmaker: book.bookmaker, probabilities, overround }
}

/** Returns de-vigged vectors for every book with all required outcomes. */
function getCompleteBookFairValues(prepared: PreparedMarket): BookFairValue[] {
  const complete: BookFairValue[] = []
  for (const bookmaker of [...prepared.books.keys()].sort()) {
    const book = prepared.books.get(bookmaker)
    if (book === undefined) continue
    const fair = getBookFairValue(book, prepared.outcomeKeys)
    if (fair !== null) complete.push(fair)
  }
  return complete
}

/** Builds either the preferred sharp anchor or a lower-vig-weighted consensus anchor. */
function buildAnchorFromPrepared(
  prepared: PreparedMarket,
  options: ResolvedEdgeOptions,
): FairValueAnchor | null {
  for (const sharpBookmaker of options.sharpBookmakers) {
    const book = prepared.books.get(sharpBookmaker)
    if (book === undefined) continue

    const fair = getBookFairValue(book, prepared.outcomeKeys)
    if (fair === null) continue

    return {
      source: "sharp",
      bookmaker: fair.bookmaker,
      probabilities: fair.probabilities.map((probability, index) => ({
        outcome:
          prepared.outcomeLabels.get(prepared.outcomeKeys[index] ?? "") ??
          (prepared.outcomeKeys[index] ?? ""),
        probability,
      })),
      contributingBookmakers: [fair.bookmaker],
      overround: fair.overround,
    }
  }

  const books = getCompleteBookFairValues(prepared)
  if (books.length < options.minConsensusBooks) return null

  const weighted = prepared.outcomeKeys.map(() => 0)
  let totalWeight = 0
  let weightedOverround = 0

  for (const book of books) {
    // Inverse overround is stable and gives lower-hold books modestly more influence.
    const weight = 1 / book.overround
    totalWeight += weight
    weightedOverround += book.overround * weight
    for (let index = 0; index < weighted.length; index += 1) {
      weighted[index] = (weighted[index] ?? 0) + (book.probabilities[index] ?? 0) * weight
    }
  }

  if (!Number.isFinite(totalWeight) || totalWeight <= EPSILON) return null
  const rawConsensus = weighted.map((value) => value / totalWeight)
  const consensusTotal = rawConsensus.reduce((sum, value) => sum + value, 0)
  if (!Number.isFinite(consensusTotal) || consensusTotal <= EPSILON) return null
  const probabilities = rawConsensus.map((value) => value / consensusTotal)

  return {
    source: "consensus",
    probabilities: probabilities.map((probability, index) => ({
      outcome:
        prepared.outcomeLabels.get(prepared.outcomeKeys[index] ?? "") ??
        (prepared.outcomeKeys[index] ?? ""),
      probability,
    })),
    contributingBookmakers: books.map((book) => book.bookmaker),
    overround: weightedOverround / totalWeight,
  }
}

/** Computes event-level confidence from depth, cross-book agreement, anchor quality, and time. */
function calculateConfidence(
  completeBooks: readonly BookFairValue[],
  hasSharpAnchor: boolean,
  options: ResolvedEdgeOptions,
): { score: number; breakdown: ConfidenceBreakdown } {
  const booksScore = clamp(completeBooks.length / options.targetBookCount, 0, 1)
  const meanProbabilityStdev = calculateMeanProbabilityStdev(completeBooks)
  const agreementScore =
    meanProbabilityStdev === null
      ? 0.5
      : clamp(1 - meanProbabilityStdev / options.agreementStdevCeiling, 0, 1)
  const sharpAnchorScore = hasSharpAnchor ? 1 : 0.4
  const time = calculateTimeToEventScore(options.eventTime, options.asOf)

  const rawScore =
    booksScore * 0.25 + agreementScore * 0.35 + sharpAnchorScore * 0.25 + time.score * 0.15
  const score = Math.round(clamp(rawScore, 0, 1) * 100)

  return {
    score,
    breakdown: {
      books: booksScore,
      agreement: agreementScore,
      sharpAnchor: sharpAnchorScore,
      timeToEvent: time.score,
      meanProbabilityStdev,
      timeToEventHours: time.hours,
    },
  }
}

/** Calculates the average population stdev across outcome probabilities. */
function calculateMeanProbabilityStdev(books: readonly BookFairValue[]): number | null {
  if (books.length < 2) return null
  const outcomeCount = books[0]?.probabilities.length ?? 0
  if (outcomeCount !== 2 && outcomeCount !== 3) return null

  let stdevSum = 0
  for (let outcomeIndex = 0; outcomeIndex < outcomeCount; outcomeIndex += 1) {
    const values = books.map((book) => book.probabilities[outcomeIndex] ?? Number.NaN)
    if (values.some((value) => !Number.isFinite(value))) return null
    stdevSum += populationStdev(values)
  }
  return stdevSum / outcomeCount
}

/** Calculates population standard deviation for a non-empty numeric array. */
function populationStdev(values: readonly number[]): number {
  if (values.length === 0) return 0
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length
  return Math.sqrt(variance)
}

/** Maps time-to-event into a 0..1 heuristic without reading the system clock. */
function calculateTimeToEventScore(
  eventTime: string | undefined,
  asOf: string | undefined,
): { score: number; hours: number | null } {
  const eventMillis = parseIsoMillis(eventTime)
  const asOfMillis = parseIsoMillis(asOf)
  if (eventMillis === null || asOfMillis === null) return { score: 0.5, hours: null }

  const hours = (eventMillis - asOfMillis) / 3_600_000
  if (hours < 0) return { score: 0.1, hours }
  if (hours < 0.25) return { score: 0.75, hours }
  if (hours <= 6) return { score: 1, hours }
  if (hours <= 24) return { score: 0.9, hours }
  if (hours <= 72) return { score: 0.75, hours }
  if (hours <= 168) return { score: 0.6, hours }
  return { score: 0.4, hours }
}

/** Sorts highest EV first, with stable lexical tie-breaks. */
function compareEvaluatedQuotes(left: EvaluatedQuote, right: EvaluatedQuote): number {
  const evDifference = right.ev - left.ev
  if (Math.abs(evDifference) > EPSILON) return evDifference
  const decimalDifference = right.decimal - left.decimal
  if (Math.abs(decimalDifference) > EPSILON) return decimalDifference
  const bookmakerDifference = compareText(left.bookmaker, right.bookmaker)
  if (bookmakerDifference !== 0) return bookmakerDifference
  return compareText(left.outcome, right.outcome)
}

/** Clamps a number to an inclusive range. */
function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

/** Filters and deterministically sorts point-bearing spread/total quotes. */
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

/** Ranks middle candidates by width, then by lower two-leg implied cost. */
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
