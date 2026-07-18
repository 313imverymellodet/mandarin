import {
  assessSignalPersistence,
  buildCalibrationBins,
  calculateBrierScore,
  calculateClosingLineValue,
  calculateLogLoss,
  summarizeEdgeBacktest,
} from "./edge-history"

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function assertClose(actual: number, expected: number, tolerance = 1e-9): void {
  assert(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`)
}

const persistence = assessSignalPersistence(
  [
    {
      observedAt: "2026-07-15T12:00:00Z",
      bookmaker: "draftkings",
      outcome: "Alpha",
      decimal: 2.1,
      fairProbability: 0.5,
      conservativeEv: 0.025,
      confidence: 78,
    },
    {
      observedAt: "2026-07-15T11:59:00Z",
      bookmaker: "draftkings",
      outcome: "Alpha",
      decimal: 2.08,
      fairProbability: 0.5,
      conservativeEv: 0.02,
      confidence: 76,
    },
    {
      observedAt: "2026-07-15T11:58:00Z",
      bookmaker: "draftkings",
      outcome: "Alpha",
      decimal: 2.06,
      fairProbability: 0.5,
      conservativeEv: 0.015,
      confidence: 74,
    },
  ],
  "draftkings",
  "Alpha",
  {
    minimumConservativeEv: 0.01,
    minimumConfidence: 70,
    requiredSnapshots: 2,
    requiredDurationSeconds: 60,
    maximumGapSeconds: 90,
  },
)
assert(persistence.confirmed, "Signal should persist across snapshots")
assert(persistence.consecutiveSnapshots === 3, "Expected three consecutive snapshots")
assertClose(persistence.durationSeconds, 120)
assert(persistence.trend === "strengthening", "Expected strengthening signal")

const expiredCurrent = assessSignalPersistence(
  [
    {
      observedAt: "2026-07-15T12:01:00Z",
      bookmaker: "draftkings",
      outcome: "Alpha",
      decimal: 2.0,
      fairProbability: 0.5,
      conservativeEv: -0.01,
      confidence: 78,
    },
    {
      observedAt: "2026-07-15T12:00:00Z",
      bookmaker: "draftkings",
      outcome: "Alpha",
      decimal: 2.1,
      fairProbability: 0.5,
      conservativeEv: 0.025,
      confidence: 78,
    },
    {
      observedAt: "2026-07-15T11:59:00Z",
      bookmaker: "draftkings",
      outcome: "Alpha",
      decimal: 2.08,
      fairProbability: 0.5,
      conservativeEv: 0.02,
      confidence: 76,
    },
  ],
  "draftkings",
  "Alpha",
  { minimumConservativeEv: 0.01, requiredSnapshots: 2 },
)
assert(!expiredCurrent.confirmed, "Older edges cannot confirm a no-longer-valid current quote")
assert(expiredCurrent.consecutiveSnapshots === 0, "Current snapshot must qualify")

assertClose(calculateClosingLineValue(2.1, 0.52) ?? Number.NaN, 0.092)

const records = [
  { fairProbability: 0.6, decimalTaken: 1.9, won: true, closingFairProbability: 0.62 },
  { fairProbability: 0.55, decimalTaken: 2.0, won: false, closingFairProbability: 0.54 },
  { fairProbability: 0.4, decimalTaken: 2.7, won: true, closingFairProbability: 0.41 },
  { fairProbability: 0.35, decimalTaken: 3.0, won: false, closingFairProbability: 0.36 },
] as const

const brier = calculateBrierScore(records)
const logLoss = calculateLogLoss(records)
assert(brier !== null && brier > 0, "Expected Brier score")
assert(logLoss !== null && logLoss > 0, "Expected log loss")

const bins = buildCalibrationBins(records, 5)
assert(bins.length > 0, "Expected nonempty calibration bins")

const summary = summarizeEdgeBacktest(records)
assert(summary !== null, "Expected backtest summary")
assert(summary.bets === 4, "Expected four bets")
assertClose(summary.hitRate, 0.5)
assert(summary.meanClosingLineValue !== null, "Expected CLV")
assert(summary.positiveClvRate !== null, "Expected positive CLV rate")

console.log("edge-history.test.ts: all assertions passed")
