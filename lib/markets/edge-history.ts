const EPSILON = 1e-12
const PROBABILITY_EPSILON = 1e-12

/** One stored observation of an already-computed edge signal. */
export interface EdgeSignalSnapshot {
  observedAt: string
  bookmaker: string
  outcome: string
  decimal: number
  fairProbability: number
  conservativeEv: number
  confidence: number
}

/** Controls confirmation of an edge across repeated polling snapshots. */
export interface SignalPersistenceOptions {
  minimumConservativeEv?: number
  minimumConfidence?: number
  requiredSnapshots?: number
  requiredDurationSeconds?: number
  maximumGapSeconds?: number
}

/** Persistence and trend diagnostics for one book/outcome edge. */
export interface SignalPersistenceResult {
  confirmed: boolean
  consecutiveSnapshots: number
  durationSeconds: number
  minimumConservativeEv: number
  maximumConservativeEv: number
  meanConservativeEv: number
  trend: "strengthening" | "stable" | "weakening"
  latestObservedAt: string | null
}

/** One settled prediction/bet for backtest and calibration reporting. */
export interface SettledEdgeRecord {
  fairProbability: number
  decimalTaken: number
  won: boolean
  stakeFraction?: number
  closingFairProbability?: number
}

/** A reliability-bin result for binary probability calibration. */
export interface CalibrationBin {
  lowerBound: number
  upperBound: number
  count: number
  meanForecast: number
  observedRate: number
  calibrationError: number
}

/** Aggregate scorecard focused on value and calibration, not raw hit rate alone. */
export interface EdgeBacktestSummary {
  bets: number
  wins: number
  hitRate: number
  expectedHitRate: number
  flatStakeRoi: number
  expectedRoiAtPlacement: number
  meanClosingLineValue: number | null
  positiveClvRate: number | null
  brierScore: number
  logLoss: number
  maximumFlatStakeDrawdown: number
}

/**
 * Confirms that a signal survives consecutive observations instead of appearing
 * for one stale/transient tick. Supply snapshots from newest or oldest order;
 * the function sorts deterministically and never reads the clock.
 */
export function assessSignalPersistence(
  snapshots: readonly EdgeSignalSnapshot[],
  bookmaker: string,
  outcome: string,
  options: SignalPersistenceOptions = {},
): SignalPersistenceResult {
  const minimumConservativeEv = finiteOr(options.minimumConservativeEv, 0)
  const minimumConfidence = clamp(finiteOr(options.minimumConfidence, 0), 0, 100)
  const requiredSnapshots = positiveInteger(options.requiredSnapshots, 2)
  const requiredDurationSeconds = nonNegativeFinite(options.requiredDurationSeconds, 0)
  const maximumGapSeconds = positiveFinite(options.maximumGapSeconds, 180)
  const bookmakerKey = normalizeKey(bookmaker)
  const outcomeKey = normalizeKey(outcome)

  const ordered = snapshots
    .filter(
      (snapshot) =>
        normalizeKey(snapshot.bookmaker) === bookmakerKey &&
        normalizeKey(snapshot.outcome) === outcomeKey &&
        Number.isFinite(snapshot.conservativeEv) &&
        Number.isFinite(snapshot.confidence) &&
        parseMillis(snapshot.observedAt) !== null,
    )
    .sort((left, right) => (parseMillis(right.observedAt) ?? 0) - (parseMillis(left.observedAt) ?? 0))

  const qualifying: EdgeSignalSnapshot[] = []
  let previousMillis: number | null = null

  for (const snapshot of ordered) {
    const millis = parseMillis(snapshot.observedAt)
    if (millis === null) continue
    if (
      snapshot.conservativeEv + EPSILON < minimumConservativeEv ||
      snapshot.confidence + EPSILON < minimumConfidence
    ) {
      break
    }
    if (
      previousMillis !== null &&
      (previousMillis - millis) / 1000 > maximumGapSeconds
    ) {
      break
    }
    qualifying.push(snapshot)
    previousMillis = millis
  }

  const latest = qualifying[0]
  const oldest = qualifying[qualifying.length - 1]
  const latestMillis = latest ? parseMillis(latest.observedAt) : null
  const oldestMillis = oldest ? parseMillis(oldest.observedAt) : null
  const durationSeconds =
    latestMillis !== null && oldestMillis !== null
      ? Math.max(0, (latestMillis - oldestMillis) / 1000)
      : 0
  const evValues = qualifying.map((snapshot) => snapshot.conservativeEv)
  const latestEv = evValues[0] ?? 0
  const oldestEv = evValues[evValues.length - 1] ?? latestEv
  const change = latestEv - oldestEv
  const trend =
    Math.abs(change) < 0.0025 ? "stable" : change > 0 ? "strengthening" : "weakening"

  return {
    confirmed:
      qualifying.length >= requiredSnapshots &&
      durationSeconds + EPSILON >= requiredDurationSeconds,
    consecutiveSnapshots: qualifying.length,
    durationSeconds,
    minimumConservativeEv: evValues.length > 0 ? Math.min(...evValues) : 0,
    maximumConservativeEv: evValues.length > 0 ? Math.max(...evValues) : 0,
    meanConservativeEv: evValues.length > 0 ? mean(evValues) : 0,
    trend,
    latestObservedAt: latest?.observedAt ?? null,
  }
}

/**
 * Closing-line value as expected return at the price taken using closing fair
 * probability: closingP * decimalTaken - 1. Positive values mean price beaten.
 */
export function calculateClosingLineValue(
  decimalTaken: number,
  closingFairProbability: number,
): number | null {
  if (!isValidDecimal(decimalTaken) || !isProbability(closingFairProbability)) return null
  return closingFairProbability * decimalTaken - 1
}

/** Brier score for binary win/loss forecasts; lower is better. */
export function calculateBrierScore(records: readonly SettledEdgeRecord[]): number | null {
  const valid = validSettledRecords(records)
  if (valid.length === 0) return null
  return mean(valid.map((record) => (record.fairProbability - (record.won ? 1 : 0)) ** 2))
}

/** Binary log loss with probability clipping; lower is better. */
export function calculateLogLoss(records: readonly SettledEdgeRecord[]): number | null {
  const valid = validSettledRecords(records)
  if (valid.length === 0) return null
  return mean(
    valid.map((record) => {
      const probability = clamp(
        record.fairProbability,
        PROBABILITY_EPSILON,
        1 - PROBABILITY_EPSILON,
      )
      return record.won ? -Math.log(probability) : -Math.log(1 - probability)
    }),
  )
}

/**
 * Builds equal-width reliability bins. Use these to verify that, for example,
 * forecasts around 60% actually win around 60% over a sufficiently large sample.
 */
export function buildCalibrationBins(
  records: readonly SettledEdgeRecord[],
  binCount = 10,
): CalibrationBin[] {
  const valid = validSettledRecords(records)
  const bins = Math.max(2, Math.floor(binCount))
  const result: CalibrationBin[] = []

  for (let index = 0; index < bins; index += 1) {
    const lowerBound = index / bins
    const upperBound = (index + 1) / bins
    const members = valid.filter((record) => {
      if (index === bins - 1) {
        return record.fairProbability >= lowerBound && record.fairProbability <= upperBound
      }
      return record.fairProbability >= lowerBound && record.fairProbability < upperBound
    })
    if (members.length === 0) continue

    const meanForecast = mean(members.map((record) => record.fairProbability))
    const observedRate = mean(members.map((record) => (record.won ? 1 : 0)))
    result.push({
      lowerBound,
      upperBound,
      count: members.length,
      meanForecast,
      observedRate,
      calibrationError: observedRate - meanForecast,
    })
  }

  return result
}

/**
 * Summarizes flat-stake realized performance, forecast calibration, expected EV,
 * closing-line value, and drawdown. It deliberately reports hit rate alongside
 * expected hit rate so favorite-heavy strategies cannot look good by hit rate alone.
 */
export function summarizeEdgeBacktest(
  records: readonly SettledEdgeRecord[],
): EdgeBacktestSummary | null {
  const valid = validSettledRecords(records)
  if (valid.length === 0) return null

  let bankroll = 0
  let peak = 0
  let maximumDrawdown = 0
  const returns: number[] = []
  const closingValues: number[] = []

  for (const record of valid) {
    const realizedReturn = record.won ? record.decimalTaken - 1 : -1
    returns.push(realizedReturn)
    bankroll += realizedReturn
    peak = Math.max(peak, bankroll)
    maximumDrawdown = Math.max(maximumDrawdown, peak - bankroll)

    if (record.closingFairProbability !== undefined) {
      const clv = calculateClosingLineValue(record.decimalTaken, record.closingFairProbability)
      if (clv !== null) closingValues.push(clv)
    }
  }

  const brierScore = calculateBrierScore(valid)
  const logLoss = calculateLogLoss(valid)
  if (brierScore === null || logLoss === null) return null

  return {
    bets: valid.length,
    wins: valid.filter((record) => record.won).length,
    hitRate: mean(valid.map((record) => (record.won ? 1 : 0))),
    expectedHitRate: mean(valid.map((record) => record.fairProbability)),
    flatStakeRoi: mean(returns),
    expectedRoiAtPlacement: mean(
      valid.map((record) => record.fairProbability * record.decimalTaken - 1),
    ),
    meanClosingLineValue: closingValues.length > 0 ? mean(closingValues) : null,
    positiveClvRate:
      closingValues.length > 0
        ? mean(closingValues.map((value) => (value > 0 ? 1 : 0)))
        : null,
    brierScore,
    logLoss,
    maximumFlatStakeDrawdown: maximumDrawdown,
  }
}

/** Filters malformed records without throwing. */
function validSettledRecords(records: readonly SettledEdgeRecord[]): SettledEdgeRecord[] {
  return records.filter(
    (record) =>
      isProbability(record.fairProbability) &&
      isValidDecimal(record.decimalTaken) &&
      (record.closingFairProbability === undefined ||
        isProbability(record.closingFairProbability)),
  )
}

function isProbability(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1
}

function isValidDecimal(value: number): boolean {
  return Number.isFinite(value) && value > 1
}

function parseMillis(value: string): number | null {
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase()
}

function mean(values: readonly number[]): number {
  return values.length === 0 ? 0 : values.reduce((total, value) => total + value, 0) / values.length
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function finiteOr(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) ? value : fallback
}

function nonNegativeFinite(value: number | undefined, fallback: number): number {
  const resolved = finiteOr(value, fallback)
  return resolved >= 0 ? resolved : fallback
}

function positiveFinite(value: number | undefined, fallback: number): number {
  const resolved = finiteOr(value, fallback)
  return resolved > 0 ? resolved : fallback
}

function positiveInteger(value: number | undefined, fallback: number): number {
  return Math.max(1, Math.floor(positiveFinite(value, fallback)))
}
