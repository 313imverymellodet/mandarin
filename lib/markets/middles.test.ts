import {
  balancedMiddleStakeFractions,
  buildMiddleStakePlan,
  discreteConditionalWinProbabilityAbove,
  findBestMiddle,
  findMiddleOpportunities,
  inferDiscreteNormalMeanFromConditionalWin,
  inferTruncatedDiscreteNormalMeanFromConditionalWin,
  normalCdf,
  normalInv,
  truncatedDiscreteConditionalWinProbabilityAbove,
  type PointOutcomeQuote,
} from "./middles"

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function close(actual: number, expected: number, tolerance = 1e-7): void {
  assert(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`)
}

close(normalCdf(0), 0.5, 1e-7)
close(normalInv(0.5), 0, 1e-9)
close(normalCdf(normalInv(0.8)), 0.8, 1e-6)

const inferredPushAwareMean = inferDiscreteNormalMeanFromConditionalWin(220, 0.6, 10)
close(discreteConditionalWinProbabilityAbove(220, inferredPushAwareMean, 10), 0.6, 1e-9)
close(inferDiscreteNormalMeanFromConditionalWin(220, 0.5, 10), 220, 1e-8)

// Totals are truncated at zero. Round-trip probability inference must remain
// accurate even for a low mean where an untruncated normal has negative mass.
const lowTotalMean = 2.2
const lowTotalSigma = 2.5
const lowTotalProbability = truncatedDiscreteConditionalWinProbabilityAbove(2.5, lowTotalMean, lowTotalSigma)
assert(lowTotalProbability > 0 && lowTotalProbability < 1, "Truncated total probability must be valid")
close(
  inferTruncatedDiscreteNormalMeanFromConditionalWin(2.5, lowTotalProbability, lowTotalSigma),
  lowTotalMean,
  1e-7,
)

const minus110 = 100 / 110 + 1
const split = balancedMiddleStakeFractions(minus110, minus110)
assert(split !== null, "Expected balanced fractions")
close(split[0], 0.5)
close(split[1], 0.5)

const asOf = "2026-07-30T14:00:00.000Z"
const eventTime = "2026-07-30T20:00:00.000Z"
const stamp = "2026-07-30T13:59:30.000Z"

const totalQuotes: PointOutcomeQuote[] = [
  { market: "totals", outcome: "Over", point: 221.5, bookmaker: "pinnacle", decimal: minus110, lastUpdate: stamp },
  { market: "totals", outcome: "Under", point: 221.5, bookmaker: "pinnacle", decimal: minus110, lastUpdate: stamp },
  { market: "totals", outcome: "Over", point: 220.5, bookmaker: "draftkings", decimal: minus110, lastUpdate: stamp },
  { market: "totals", outcome: "Under", point: 220.5, bookmaker: "draftkings", decimal: minus110, lastUpdate: stamp },
  { market: "totals", outcome: "Over", point: 222.5, bookmaker: "fanduel", decimal: minus110, lastUpdate: stamp },
  { market: "totals", outcome: "Under", point: 222.5, bookmaker: "fanduel", decimal: minus110, lastUpdate: stamp },
  { market: "totals", outcome: "Over", point: 221.5, bookmaker: "betmgm", decimal: 1.91, lastUpdate: stamp },
  { market: "totals", outcome: "Under", point: 221.5, bookmaker: "betmgm", decimal: 1.91, lastUpdate: stamp },
]

const total = findBestMiddle(totalQuotes, {
  sportKey: "basketball_nba",
  sharpBookmakers: ["pinnacle"],
  eligibleBookmakers: ["draftkings", "fanduel", "betmgm"],
  asOf,
  eventTime,
  minCompleteBooks: 2,
  minDistinctAnchorPoints: 1,
  minimumFitQuality: 0,
  minimumConfidence: 0,
  minimumConservativeEv: -1,
  minimumMiddleProbability: 0,
  maximumOutsideLoss: 1,
})
assert(total !== null, "Expected a totals middle")
assert(total.market === "totals", "Expected totals")
assert(total.legs[0].quote.bookmaker === "draftkings", "Best Over should come from DraftKings")
assert(total.legs[1].quote.bookmaker === "fanduel", "Best Under should come from FanDuel")
assert(total.lowerBound === 220.5 && total.upperBound === 222.5, "Wrong middle bounds")
assert(total.landingValues.join(",") === "221,222", "Both-win totals should be 221 and 222")
close(total.bothWinProfit, minus110 - 1)
close(total.outsideWindowProfit, minus110 / 2 - 1)
assert(total.estimatedMiddleProbability > 0, "Middle probability should be modeled")
assert(Number.isFinite(total.rawEv), "EV should be finite")
close(
  Object.values(total.probabilityBreakdown).reduce((sum, value) => sum + value, 0),
  1,
  1e-7,
)
assert(total.breakEvenMiddleProbability > 0, "Break-even middle probability should be reported")

const middlePlan = buildMiddleStakePlan(total.legs[0].quote, total.legs[1].quote, 100, 2)
assert(middlePlan !== null, "Expected a rounded middle stake plan")
close(middlePlan.legs[0].stake + middlePlan.legs[1].stake, 100)
assert(middlePlan.payoutImbalance <= 0.02, "Outside outcomes should be balanced")

const spreadQuotes: PointOutcomeQuote[] = [
  { market: "spreads", outcome: "Home", point: 3, bookmaker: "pinnacle", decimal: minus110, lastUpdate: stamp },
  { market: "spreads", outcome: "Away", point: -3, bookmaker: "pinnacle", decimal: minus110, lastUpdate: stamp },
  { market: "spreads", outcome: "Home", point: 3.5, bookmaker: "draftkings", decimal: minus110, lastUpdate: stamp },
  { market: "spreads", outcome: "Away", point: -3.5, bookmaker: "draftkings", decimal: minus110, lastUpdate: stamp },
  { market: "spreads", outcome: "Home", point: 2.5, bookmaker: "fanduel", decimal: minus110, lastUpdate: stamp },
  { market: "spreads", outcome: "Away", point: -2.5, bookmaker: "fanduel", decimal: minus110, lastUpdate: stamp },
  { market: "spreads", outcome: "Home", point: 3, bookmaker: "betmgm", decimal: 1.91, lastUpdate: stamp },
  { market: "spreads", outcome: "Away", point: -3, bookmaker: "betmgm", decimal: 1.91, lastUpdate: stamp },
]

const spread = findBestMiddle(spreadQuotes, {
  sportKey: "americanfootball_nfl",
  homeTeam: "Home",
  awayTeam: "Away",
  eligibleBookmakers: ["draftkings", "fanduel", "betmgm"],
  asOf,
  eventTime,
  minCompleteBooks: 2,
  minDistinctAnchorPoints: 1,
  minimumFitQuality: 0,
  minimumConfidence: 0,
  minimumConservativeEv: -1,
  minimumMiddleProbability: 0,
  maximumOutsideLoss: 1,
})
assert(spread !== null, "Expected a spread middle")
assert(spread.lowerBound === -3.5 && spread.upperBound === -2.5, "Wrong spread bounds")
assert(spread.landingValues.join(",") === "-3", "The only both-win margin should be -3")
assert(spread.windowLabel.includes("loses by 3"), "Window label should explain the canonical margin")
assert(spread.keyNumbersInWindow.includes(-3), "NFL key number should be flagged")

const sameBookOnly = findMiddleOpportunities(
  [
    { market: "totals", outcome: "Over", point: 220.5, bookmaker: "one", decimal: 2, lastUpdate: stamp },
    { market: "totals", outcome: "Under", point: 222.5, bookmaker: "one", decimal: 2, lastUpdate: stamp },
  ],
  { sportKey: "basketball_nba", asOf, eventTime, minimumConfidence: 0, minCompleteBooks: 2 },
)
assert(sameBookOnly.length === 0, "A middle must use different books")

const circularTwoBookMarket: PointOutcomeQuote[] = [
  { market: "totals", outcome: "Over", point: 220.5, bookmaker: "draftkings", decimal: minus110, lastUpdate: stamp },
  { market: "totals", outcome: "Under", point: 220.5, bookmaker: "draftkings", decimal: minus110, lastUpdate: stamp },
  { market: "totals", outcome: "Over", point: 222.5, bookmaker: "fanduel", decimal: minus110, lastUpdate: stamp },
  { market: "totals", outcome: "Under", point: 222.5, bookmaker: "fanduel", decimal: minus110, lastUpdate: stamp },
]
const circularResult = findMiddleOpportunities(circularTwoBookMarket, {
  sportKey: "basketball_nba",
  eligibleBookmakers: ["draftkings", "fanduel"],
  asOf,
  eventTime,
  minCompleteBooks: 2,
  minimumConfidence: 0,
  minimumConservativeEv: -1,
  minimumMiddleProbability: 0,
  maximumOutsideLoss: 1,
})
assert(circularResult.length === 0, "The two target books must be excluded from their own anchor")

// Quarter lines are settlement-safe elsewhere, but this model fails closed until
// split-payoff probabilities have their own held-out calibration.
const quarterLines = findMiddleOpportunities(
  [
    { market: "totals", outcome: "Over", point: 2.25, bookmaker: "a", decimal: 1.91, lastUpdate: stamp },
    { market: "totals", outcome: "Under", point: 2.25, bookmaker: "a", decimal: 1.91, lastUpdate: stamp },
    { market: "totals", outcome: "Over", point: 2.75, bookmaker: "b", decimal: 1.91, lastUpdate: stamp },
    { market: "totals", outcome: "Under", point: 2.75, bookmaker: "b", decimal: 1.91, lastUpdate: stamp },
  ],
  { sportKey: "soccer_epl", asOf, eventTime, minCompleteBooks: 2 },
)
assert(quarterLines.length === 0, "Quarter lines must not be mis-modeled as full lines")

// Target quote skew is surfaced and blocks actionability.
const skewed = findBestMiddle(
  [
    ...totalQuotes.filter((quote) => quote.bookmaker === "pinnacle" || quote.bookmaker === "betmgm"),
    { market: "totals", outcome: "Over", point: 220.5, bookmaker: "draftkings", decimal: minus110, lastUpdate: "2026-07-30T13:59:50.000Z" },
    { market: "totals", outcome: "Under", point: 220.5, bookmaker: "draftkings", decimal: minus110, lastUpdate: "2026-07-30T13:59:50.000Z" },
    { market: "totals", outcome: "Over", point: 222.5, bookmaker: "fanduel", decimal: minus110, lastUpdate: "2026-07-30T13:57:50.000Z" },
    { market: "totals", outcome: "Under", point: 222.5, bookmaker: "fanduel", decimal: minus110, lastUpdate: "2026-07-30T13:57:50.000Z" },
  ],
  {
    sportKey: "basketball_nba",
    eligibleBookmakers: ["draftkings", "fanduel"],
    asOf,
    eventTime,
    maxQuoteAgeMs: 5 * 60_000,
    maxTargetQuoteSkewMs: 30_000,
    minCompleteBooks: 2,
    minDistinctAnchorPoints: 1,
    minimumFitQuality: 0,
    minimumConfidence: 0,
    minimumConservativeEv: -1,
    minimumMiddleProbability: 0,
    maximumOutsideLoss: 1,
  },
)
assert(skewed !== null, "Expected a skewed candidate")
assert(skewed.status === "candidate", "Skewed prices cannot be actionable")
assert(skewed.rejectionReasons.includes("target_quote_skew_too_large"), "Expected skew rejection")

// Synthetic alternate-line ladders should recover both mean and sigma instead
// of relying only on a fixed sport prior.
const trueMean = 221.8
const trueSigma = 15.2
const ladderPoints = [214.5, 221.5, 228.5]
const ladderBooks = ["pinnacle", "anchor-two", "anchor-three"]
const ladder: PointOutcomeQuote[] = []
for (const bookmaker of ladderBooks) {
  for (const point of ladderPoints) {
    const p = truncatedDiscreteConditionalWinProbabilityAbove(point, trueMean, trueSigma)
    ladder.push(
      { market: "totals", outcome: "Over", point, bookmaker, decimal: 1 / p, lastUpdate: stamp },
      { market: "totals", outcome: "Under", point, bookmaker, decimal: 1 / (1 - p), lastUpdate: stamp },
    )
  }
}
ladder.push(
  { market: "totals", outcome: "Over", point: 219.5, bookmaker: "target-over", decimal: 1.91, lastUpdate: stamp },
  { market: "totals", outcome: "Under", point: 219.5, bookmaker: "target-over", decimal: 1.91, lastUpdate: stamp },
  { market: "totals", outcome: "Over", point: 224.5, bookmaker: "target-under", decimal: 1.91, lastUpdate: stamp },
  { market: "totals", outcome: "Under", point: 224.5, bookmaker: "target-under", decimal: 1.91, lastUpdate: stamp },
)
const fitted = findBestMiddle(ladder, {
  sportKey: "basketball_nba",
  sharpBookmakers: ["pinnacle"],
  eligibleBookmakers: ["target-over", "target-under"],
  asOf,
  eventTime,
  minCompleteBooks: 3,
  minDistinctAnchorPoints: 2,
  minimumFitQuality: 0,
  minimumConfidence: 0,
  minimumConservativeEv: -1,
  minimumMiddleProbability: 0,
  maximumOutsideLoss: 1,
})
assert(fitted !== null, "Expected a ladder-fitted middle")
assert(fitted.distribution.fitMethod === "market_ladder", "Sigma should be fitted from the ladder")
assert(fitted.distribution.observationCount === 9, "All matched alternate lines should contribute")
assert(fitted.distribution.distinctPointCount === 3, "Expected three distinct thresholds")
close(fitted.distribution.mean, trueMean, 0.35)
close(fitted.distribution.sigma, trueSigma, 0.75)
assert(fitted.distribution.fitQuality > 0.9, "Synthetic exact ladder should fit well")

console.log("middles.test.ts: all assertions passed")

assert(
  total.rejectionReasons.includes("actionable_disabled"),
  "Middles must fail closed until a held-out calibration is explicitly enabled",
)
assert(total.status === "candidate", "Default middle status must be candidate")

const enabledTotal = findBestMiddle(totalQuotes, {
  sportKey: "basketball_nba",
  sharpBookmakers: ["pinnacle"],
  eligibleBookmakers: ["draftkings", "fanduel", "betmgm"],
  asOf,
  eventTime,
  minCompleteBooks: 2,
  minDistinctAnchorPoints: 1,
  minimumFitQuality: 0,
  minimumConfidence: 0,
  minimumConservativeEv: -1,
  minimumMiddleProbability: 0,
  maximumOutsideLoss: 1,
  allowActionable: true,
  calibrationId: "test-only-held-out-v1",
})
assert(enabledTotal !== null, "Expected explicitly enabled middle")
assert(enabledTotal.status === "actionable", "Calibration gate should allow actionability")
assert(enabledTotal.calibrationId === "test-only-held-out-v1", "Calibration tag must be auditable")

const missingCalibration = findBestMiddle(totalQuotes, {
  sportKey: "basketball_nba",
  sharpBookmakers: ["pinnacle"],
  eligibleBookmakers: ["draftkings", "fanduel"],
  asOf,
  eventTime,
  minCompleteBooks: 2,
  minDistinctAnchorPoints: 1,
  minimumFitQuality: 0,
  minimumConfidence: 0,
  minimumConservativeEv: -1,
  minimumMiddleProbability: 0,
  maximumOutsideLoss: 1,
  allowActionable: true,
})
assert(missingCalibration !== null, "Expected candidate without calibration tag")
assert(
  missingCalibration.rejectionReasons.includes("missing_calibration_id"),
  "Actionability requires a calibration version",
)

const anchorSkewed = findBestMiddle(
  [
    { market: "totals", outcome: "Over", point: 221.5, bookmaker: "pinnacle", decimal: minus110, lastUpdate: "2026-07-30T13:59:50.000Z" },
    { market: "totals", outcome: "Under", point: 221.5, bookmaker: "pinnacle", decimal: minus110, lastUpdate: "2026-07-30T13:59:50.000Z" },
    { market: "totals", outcome: "Over", point: 221.5, bookmaker: "anchor-two", decimal: minus110, lastUpdate: "2026-07-30T13:59:50.000Z" },
    { market: "totals", outcome: "Under", point: 221.5, bookmaker: "anchor-two", decimal: minus110, lastUpdate: "2026-07-30T13:59:50.000Z" },
    { market: "totals", outcome: "Over", point: 220.5, bookmaker: "target-over", decimal: minus110, lastUpdate: "2026-07-30T13:57:30.000Z" },
    { market: "totals", outcome: "Under", point: 220.5, bookmaker: "target-over", decimal: minus110, lastUpdate: "2026-07-30T13:57:30.000Z" },
    { market: "totals", outcome: "Over", point: 222.5, bookmaker: "target-under", decimal: minus110, lastUpdate: "2026-07-30T13:57:30.000Z" },
    { market: "totals", outcome: "Under", point: 222.5, bookmaker: "target-under", decimal: minus110, lastUpdate: "2026-07-30T13:57:30.000Z" },
  ],
  {
    sportKey: "basketball_nba",
    eligibleBookmakers: ["target-over", "target-under"],
    asOf,
    eventTime,
    maxQuoteAgeMs: 4 * 60_000,
    maxTargetQuoteSkewMs: 30_000,
    maxTargetAnchorSkewMs: 30_000,
    minCompleteBooks: 2,
    minDistinctAnchorPoints: 1,
    minimumFitQuality: 0,
    minimumConfidence: 0,
    minimumConservativeEv: -1,
    minimumMiddleProbability: 0,
    maximumOutsideLoss: 1,
    allowActionable: true,
    calibrationId: "test",
  },
)
assert(anchorSkewed !== null, "Expected target-versus-anchor timing candidate")
close(anchorSkewed.targetQuoteSkewSeconds ?? NaN, 0)
assert((anchorSkewed.targetAnchorSkewSeconds ?? 0) > 100, "Expected large anchor skew")
assert(
  anchorSkewed.rejectionReasons.includes("target_anchor_skew_too_large"),
  "Synchronized target legs can still be stale relative to the anchor",
)

const independentFitted = findBestMiddle(ladder, {
  sportKey: "basketball_nba",
  sharpBookmakers: ["pinnacle"],
  eligibleBookmakers: ["target-over", "target-under"],
  asOf,
  eventTime,
  minCompleteBooks: 3,
  minDistinctAnchorPoints: 2,
  minimumFitQuality: 0,
  minimumConfidence: 0,
  minimumConservativeEv: -1,
  minimumMiddleProbability: 0,
  maximumOutsideLoss: 1,
})
const correlatedFitted = findBestMiddle(ladder, {
  sportKey: "basketball_nba",
  sharpBookmakers: ["pinnacle"],
  eligibleBookmakers: ["target-over", "target-under"],
  bookmakerCorrelationGroups: {
    "anchor-two": "shared-feed",
    "anchor-three": "shared-feed",
  },
  asOf,
  eventTime,
  minCompleteBooks: 3,
  minDistinctAnchorPoints: 2,
  minimumFitQuality: 0,
  minimumConfidence: 0,
  minimumConservativeEv: -1,
  minimumMiddleProbability: 0,
  maximumOutsideLoss: 1,
})
assert(independentFitted !== null && correlatedFitted !== null, "Expected both ladder fits")
assert(
  correlatedFitted.distribution.effectiveBookCount < independentFitted.distribution.effectiveBookCount,
  "Correlated books must not count as independent middle-model depth",
)
assert(
  correlatedFitted.distribution.correlationGroupCount < correlatedFitted.distribution.completeBookCount,
  "Correlation-group diagnostics should be exposed",
)

function timedMiddle(targetStamp: string) {
  return findBestMiddle(
    [
      { market: "totals", outcome: "Over", point: 221.5, bookmaker: "pinnacle", decimal: minus110, lastUpdate: stamp },
      { market: "totals", outcome: "Under", point: 221.5, bookmaker: "pinnacle", decimal: minus110, lastUpdate: stamp },
      { market: "totals", outcome: "Over", point: 221.5, bookmaker: "anchor-two", decimal: minus110, lastUpdate: stamp },
      { market: "totals", outcome: "Under", point: 221.5, bookmaker: "anchor-two", decimal: minus110, lastUpdate: stamp },
      { market: "totals", outcome: "Over", point: 220.5, bookmaker: "target-over", decimal: minus110, lastUpdate: targetStamp },
      { market: "totals", outcome: "Under", point: 220.5, bookmaker: "target-over", decimal: minus110, lastUpdate: targetStamp },
      { market: "totals", outcome: "Over", point: 222.5, bookmaker: "target-under", decimal: minus110, lastUpdate: targetStamp },
      { market: "totals", outcome: "Under", point: 222.5, bookmaker: "target-under", decimal: minus110, lastUpdate: targetStamp },
    ],
    {
      sportKey: "basketball_nba",
      eligibleBookmakers: ["target-over", "target-under"],
      asOf,
      eventTime,
      maxQuoteAgeMs: 4 * 60_000,
      maxTargetAnchorSkewMs: 4 * 60_000,
      minCompleteBooks: 2,
      minDistinctAnchorPoints: 1,
      minimumFitQuality: 0,
      minimumConfidence: 0,
      minimumConservativeEv: -1,
      minimumMiddleProbability: 0,
      maximumOutsideLoss: 1,
    },
  )
}
const freshTimedMiddle = timedMiddle(stamp)
const olderTimedMiddle = timedMiddle("2026-07-30T13:57:30.000Z")
assert(freshTimedMiddle !== null && olderTimedMiddle !== null, "Expected timed middles")
assert(
  olderTimedMiddle.executionBufferApplied > freshTimedMiddle.executionBufferApplied,
  "Middle execution buffer must grow with target age/skew",
)
assert(
  olderTimedMiddle.conservativeEv < freshTimedMiddle.conservativeEv,
  "Older target prices must receive lower conservative EV",
)

console.log("middles.v3-hardening.test.ts: all assertions passed")
