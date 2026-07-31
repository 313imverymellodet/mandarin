import {
  analyzePositiveEV,
  applyProbabilityCalibration,
  devigOdds,
  devigPower,
  devigProportional,
  devigShin,
  expectedValue,
  findBestPositiveEV,
  findBestSpreadMiddle,
  findBestTotalsMiddle,
  fractionalKellyStake,
  getEdgeRiskPreset,
} from "./edge"

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function assertClose(actual: number, expected: number, tolerance = 1e-9): void {
  assert(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`)
}

const minus110 = 100 / 110 + 1
for (const method of ["proportional", "power", "shin"] as const) {
  const fair = devigOdds([minus110, minus110], method)
  assert(fair !== null, `${method} should de-vig -110/-110`)
  assertClose(fair[0] ?? Number.NaN, 0.5, 1e-8)
  assertClose(fair[1] ?? Number.NaN, 0.5, 1e-8)
}

const proportional = devigProportional([2, 3, 4])
const power = devigPower([2, 3, 4])
const shin = devigShin([2, 3, 4])
for (const result of [proportional, power, shin]) {
  assert(result !== null, "Three-way de-vig should be valid")
  assertClose(result.reduce((total, probability) => total + probability, 0), 1, 1e-8)
  assert(result.every((probability) => probability > 0 && probability < 1), "Valid probabilities")
}

const identityCalibrated = applyProbabilityCalibration([0.4, 0.6], {
  kind: "beta",
  logProbabilityCoefficient: 1,
  logOneMinusProbabilityCoefficient: -1,
  intercept: 0,
})
assert(identityCalibrated !== null, "Identity beta calibration should be valid")
assertClose(identityCalibrated[0] ?? Number.NaN, 0.4, 1e-9)
assertClose(identityCalibrated[1] ?? Number.NaN, 0.6, 1e-9)

assertClose(expectedValue(2.1, 0.5) ?? Number.NaN, 0.05)
assertClose(fractionalKellyStake(2.1, 0.5, 1), 0.04545454545454549)
assertClose(fractionalKellyStake(2.1, 0.5), 0.011363636363636373)
assertClose(fractionalKellyStake(1.8, 0.5), 0)

const freshTime = "2026-07-15T12:00:00Z"
const eventTime = "2026-07-15T18:00:00Z"

const sharpBest = findBestPositiveEV(
  [
    { outcome: "Alpha", bookmaker: "pinnacle", decimal: minus110, lastUpdate: freshTime },
    { outcome: "Beta", bookmaker: "pinnacle", decimal: minus110, lastUpdate: freshTime },
    { outcome: "Alpha", bookmaker: "draftkings", decimal: 2.1, lastUpdate: freshTime },
    { outcome: "Beta", bookmaker: "draftkings", decimal: 1.8, lastUpdate: freshTime },
  ],
  {
    eligibleBookmakers: ["draftkings"],
    eventTime,
    asOf: freshTime,
  },
)
assert(sharpBest !== null, "Expected a fresh Pinnacle-anchored +EV opportunity")
assert(sharpBest.outcome === "Alpha", "Expected Alpha")
assert(sharpBest.bookmaker === "draftkings", "Expected DraftKings")
assertClose(sharpBest.fairProbability, 0.5, 1e-8)
assertClose(sharpBest.ev, 0.05, 1e-8)
assert(sharpBest.conservativeEv < sharpBest.ev, "Conservative EV must be below raw EV")
assert(sharpBest.netEv < sharpBest.conservativeEv, "Execution buffer must reduce EV")
assert(!sharpBest.anchorBookmakers.includes("draftkings"), "Target book must be excluded")
assert(sharpBest.anchorBookmakers.includes("pinnacle"), "Pinnacle must anchor the target")
assert(sharpBest.kellyStakeFraction <= 0.01 + 1e-12, "Balanced stake cap is 1%")
assert(
  sharpBest.kellyStakeFraction < fractionalKellyStake(2.1, 0.5),
  "Kelly should use conservative probability",
)

const leaveOneOut = findBestPositiveEV(
  [
    { outcome: "Alpha", bookmaker: "target-book", decimal: 3, lastUpdate: freshTime },
    { outcome: "Beta", bookmaker: "target-book", decimal: 1.4, lastUpdate: freshTime },
    { outcome: "Alpha", bookmaker: "book-a", decimal: minus110, lastUpdate: freshTime },
    { outcome: "Beta", bookmaker: "book-a", decimal: minus110, lastUpdate: freshTime },
    { outcome: "Alpha", bookmaker: "book-b", decimal: minus110, lastUpdate: freshTime },
    { outcome: "Beta", bookmaker: "book-b", decimal: minus110, lastUpdate: freshTime },
    { outcome: "Alpha", bookmaker: "book-c", decimal: minus110, lastUpdate: freshTime },
    { outcome: "Beta", bookmaker: "book-c", decimal: minus110, lastUpdate: freshTime },
  ],
  {
    eligibleBookmakers: ["target-book"],
    eventTime,
    asOf: freshTime,
  },
)
assert(leaveOneOut !== null, "Expected consensus +EV")
assertClose(leaveOneOut.fairProbability, 0.5, 1e-8)
assert(
  !leaveOneOut.anchorBookmakers.includes("target-book"),
  "Target cannot influence its own benchmark",
)
assert(leaveOneOut.anchorSource === "consensus", "Expected non-sharp consensus")

const staleAnalysis = analyzePositiveEV(
  [
    { outcome: "Alpha", bookmaker: "pinnacle", decimal: minus110, lastUpdate: freshTime },
    { outcome: "Beta", bookmaker: "pinnacle", decimal: minus110, lastUpdate: freshTime },
    {
      outcome: "Alpha",
      bookmaker: "draftkings",
      decimal: 2.1,
      lastUpdate: "2026-07-15T11:50:00Z",
    },
    {
      outcome: "Beta",
      bookmaker: "draftkings",
      decimal: 1.8,
      lastUpdate: "2026-07-15T11:50:00Z",
    },
  ],
  {
    eligibleBookmakers: ["draftkings"],
    eventTime,
    asOf: freshTime,
  },
)
assert(staleAnalysis !== null, "Expected analysis even when target is stale")
const staleTarget = staleAnalysis.evaluations.find(
  (evaluation) => evaluation.bookmaker === "draftkings" && evaluation.outcome === "Alpha",
)
assert(staleTarget !== undefined, "Expected stale target evaluation")
assert(!staleTarget.isActionable, "Stale target must not be actionable")
assert(staleTarget.rejectionReasons.includes("target_quote_stale"), "Expected stale reason")
assert(staleAnalysis.best === null, "No stale opportunity should be promoted")

const staleSharpFallback = findBestPositiveEV(
  [
    {
      outcome: "Alpha",
      bookmaker: "pinnacle",
      decimal: minus110,
      lastUpdate: "2026-07-15T11:50:00Z",
    },
    {
      outcome: "Beta",
      bookmaker: "pinnacle",
      decimal: minus110,
      lastUpdate: "2026-07-15T11:50:00Z",
    },
    { outcome: "Alpha", bookmaker: "target", decimal: 2.2, lastUpdate: freshTime },
    { outcome: "Beta", bookmaker: "target", decimal: 1.72, lastUpdate: freshTime },
    { outcome: "Alpha", bookmaker: "book-a", decimal: minus110, lastUpdate: freshTime },
    { outcome: "Beta", bookmaker: "book-a", decimal: minus110, lastUpdate: freshTime },
    { outcome: "Alpha", bookmaker: "book-b", decimal: minus110, lastUpdate: freshTime },
    { outcome: "Beta", bookmaker: "book-b", decimal: minus110, lastUpdate: freshTime },
    { outcome: "Alpha", bookmaker: "book-c", decimal: minus110, lastUpdate: freshTime },
    { outcome: "Beta", bookmaker: "book-c", decimal: minus110, lastUpdate: freshTime },
  ],
  {
    eligibleBookmakers: ["target"],
    eventTime,
    asOf: freshTime,
  },
)
assert(staleSharpFallback !== null, "Fresh consensus should replace a stale sharp anchor")
assert(staleSharpFallback.anchorSource === "consensus", "Stale Pinnacle must be excluded")
assert(!staleSharpFallback.anchorBookmakers.includes("pinnacle"), "Stale sharp cannot contribute")

const immutableInput = [
  { outcome: "Alpha", bookmaker: "pinnacle", decimal: minus110, lastUpdate: freshTime },
  { outcome: "Beta", bookmaker: "pinnacle", decimal: minus110, lastUpdate: freshTime },
  { outcome: "Alpha", bookmaker: "draftkings", decimal: 2.1, lastUpdate: freshTime },
  { outcome: "Beta", bookmaker: "draftkings", decimal: 1.8, lastUpdate: freshTime },
] as const
const before = JSON.stringify(immutableInput)
findBestPositiveEV(immutableInput, {
  eligibleBookmakers: ["draftkings"],
  eventTime,
  asOf: freshTime,
})
assert(JSON.stringify(immutableInput) === before, "Analysis must not mutate caller input")

const skewed = findBestPositiveEV(
  [
    { outcome: "Favorite", bookmaker: "pinnacle", decimal: 1.25, lastUpdate: freshTime },
    { outcome: "Dog", bookmaker: "pinnacle", decimal: 4.5, lastUpdate: freshTime },
    { outcome: "Favorite", bookmaker: "soft", decimal: 1.35, lastUpdate: freshTime },
    { outcome: "Dog", bookmaker: "soft", decimal: 4.1, lastUpdate: freshTime },
  ],
  {
    eligibleBookmakers: ["soft"],
    riskProfile: "aggressive",
    eventTime,
    asOf: freshTime,
  },
)
assert(skewed !== null, "Expected a skewed-market opportunity")
assert(skewed.probabilitySigma > 0.011, "Model disagreement should enter uncertainty")

assert(
  findBestPositiveEV([
    { outcome: "A", bookmaker: "one-soft-book", decimal: 2.2, lastUpdate: freshTime },
    { outcome: "B", bookmaker: "one-soft-book", decimal: 1.7, lastUpdate: freshTime },
  ]) === null,
  "A single non-sharp book must not anchor fair value",
)

assert(
  findBestPositiveEV([
    { outcome: "Only Side", bookmaker: "pinnacle", decimal: 2, lastUpdate: freshTime },
    { outcome: "Only Side", bookmaker: "draftkings", decimal: 2.1, lastUpdate: freshTime },
  ]) === null,
  "One-sided data must return null",
)

const spreadMiddle = findBestSpreadMiddle([
  { outcome: "Alpha", bookmaker: "book-a", decimal: 1.91, point: 3.5 },
  { outcome: "Beta", bookmaker: "book-b", decimal: 1.91, point: -2.5 },
])
assert(spreadMiddle !== null, "Expected spread middle")
assertClose(spreadMiddle.width, 1)
assertClose(spreadMiddle.lowerBound, -3.5)
assertClose(spreadMiddle.upperBound, -2.5)

const totalMiddle = findBestTotalsMiddle([
  { outcome: "Over", bookmaker: "book-a", decimal: 1.91, point: 47.5 },
  { outcome: "Under", bookmaker: "book-b", decimal: 1.91, point: 49.5 },
])
assert(totalMiddle !== null, "Expected totals middle")
assertClose(totalMiddle.width, 2)
assertClose(totalMiddle.lowerBound, 47.5)
assertClose(totalMiddle.upperBound, 49.5)

const conservativePreset = getEdgeRiskPreset("conservative")
const aggressivePreset = getEdgeRiskPreset("aggressive")
assert(
  conservativePreset.minimumFairProbability > aggressivePreset.minimumFairProbability,
  "Conservative profile should target higher-probability outcomes",
)
assert(
  conservativePreset.minimumConfidence > aggressivePreset.minimumConfidence,
  "Conservative profile should require higher signal quality",
)

console.log("edge.test.ts: all assertions passed")

// Binary calibration is not silently applied to a three-way market. A real
// multiclass calibration must be fitted before production can opt in.
const threeWayCalibration = {
  kind: "isotonic" as const,
  points: [
    { predicted: 0, calibrated: 0 },
    { predicted: 0.2, calibrated: 0.05 },
    { predicted: 0.5, calibrated: 0.8 },
    { predicted: 1, calibrated: 1 },
  ],
}
const uncalibratedThreeWay = applyProbabilityCalibration(
  [0.5, 0.3, 0.2],
  threeWayCalibration,
)
assert(uncalibratedThreeWay !== null, "Three-way probabilities should remain valid")
assertClose(uncalibratedThreeWay[0] ?? Number.NaN, 0.5)
assertClose(uncalibratedThreeWay[1] ?? Number.NaN, 0.3)
assertClose(uncalibratedThreeWay[2] ?? Number.NaN, 0.2)
const explicitlyCalibratedThreeWay = applyProbabilityCalibration(
  [0.5, 0.3, 0.2],
  threeWayCalibration,
  true,
)
assert(explicitlyCalibratedThreeWay !== null, "Explicit three-way opt-in should work")
assert(
  Math.abs((explicitlyCalibratedThreeWay[0] ?? 0) - 0.5) > 0.05,
  "Explicit calibration should materially alter this test vector",
)

const futureTargetAnalysis = analyzePositiveEV(
  [
    { outcome: "Alpha", bookmaker: "pinnacle", decimal: minus110, lastUpdate: freshTime },
    { outcome: "Beta", bookmaker: "pinnacle", decimal: minus110, lastUpdate: freshTime },
    {
      outcome: "Alpha",
      bookmaker: "future-book",
      decimal: 2.2,
      lastUpdate: "2026-07-15T12:01:00Z",
    },
    {
      outcome: "Beta",
      bookmaker: "future-book",
      decimal: 1.72,
      lastUpdate: "2026-07-15T12:01:00Z",
    },
  ],
  {
    eligibleBookmakers: ["future-book"],
    eventTime,
    asOf: freshTime,
    minimumRawEv: 0,
    minimumConservativeEv: -1,
    minimumNetEv: -1,
    minimumConfidence: 0,
    minimumFairProbability: 0,
  },
)
assert(futureTargetAnalysis !== null, "Future timestamp should remain auditable")
const futureTarget = futureTargetAnalysis.evaluations.find(
  (evaluation) => evaluation.bookmaker === "future-book" && evaluation.outcome === "Alpha",
)
assert(futureTarget !== undefined, "Expected future target evaluation")
assert(
  futureTarget.rejectionReasons.includes("target_quote_in_future"),
  "Large future clock skew must reject the signal",
)
assertClose(futureTarget.kellyStakeFraction, 0)

const timeSkewAnalysis = analyzePositiveEV(
  [
    { outcome: "Alpha", bookmaker: "pinnacle", decimal: minus110, lastUpdate: freshTime },
    { outcome: "Beta", bookmaker: "pinnacle", decimal: minus110, lastUpdate: freshTime },
    {
      outcome: "Alpha",
      bookmaker: "lagged-book",
      decimal: 2.2,
      lastUpdate: "2026-07-15T11:59:00Z",
    },
    {
      outcome: "Beta",
      bookmaker: "lagged-book",
      decimal: 1.72,
      lastUpdate: "2026-07-15T11:59:00Z",
    },
  ],
  {
    eligibleBookmakers: ["lagged-book"],
    eventTime,
    asOf: freshTime,
    maxTargetQuoteAgeSeconds: 120,
    maxTargetAnchorSkewSeconds: 30,
    minimumRawEv: 0,
    minimumConservativeEv: -1,
    minimumNetEv: -1,
    minimumConfidence: 0,
    minimumFairProbability: 0,
  },
)
assert(timeSkewAnalysis !== null, "Expected target/anchor skew analysis")
const timeSkewTarget = timeSkewAnalysis.evaluations.find(
  (evaluation) => evaluation.bookmaker === "lagged-book" && evaluation.outcome === "Alpha",
)
assert(timeSkewTarget !== undefined, "Expected lagged target evaluation")
assertClose(timeSkewTarget.targetAnchorSkewSeconds ?? Number.NaN, 60)
assert(
  timeSkewTarget.rejectionReasons.includes("target_anchor_time_skew"),
  "A target must be contemporaneous with its anchor",
)
assertClose(timeSkewTarget.kellyStakeFraction, 0)

function getTargetEvaluation(lastUpdate: string) {
  const analysis = analyzePositiveEV(
    [
      { outcome: "Alpha", bookmaker: "pinnacle", decimal: minus110, lastUpdate: freshTime },
      { outcome: "Beta", bookmaker: "pinnacle", decimal: minus110, lastUpdate: freshTime },
      { outcome: "Alpha", bookmaker: "target", decimal: 2.2, lastUpdate },
      { outcome: "Beta", bookmaker: "target", decimal: 1.72, lastUpdate },
    ],
    {
      eligibleBookmakers: ["target"],
      eventTime,
      asOf: freshTime,
      maxTargetQuoteAgeSeconds: 120,
      maxTargetAnchorSkewSeconds: 120,
      minimumRawEv: 0,
      minimumConservativeEv: -1,
      minimumNetEv: -1,
      minimumConfidence: 0,
      minimumFairProbability: 0,
    },
  )
  assert(analysis !== null, "Expected execution-buffer analysis")
  const evaluation = analysis.evaluations.find(
    (item) => item.bookmaker === "target" && item.outcome === "Alpha",
  )
  assert(evaluation !== undefined, "Expected target evaluation")
  return evaluation
}

const freshEvaluation = getTargetEvaluation(freshTime)
const olderEvaluation = getTargetEvaluation("2026-07-15T11:59:00Z")
assert(
  olderEvaluation.executionBufferEvApplied > freshEvaluation.executionBufferEvApplied,
  "Execution haircut must grow with quote age and target/anchor skew",
)
assert(
  olderEvaluation.netEv < freshEvaluation.netEv,
  "Age/skew haircut must reduce net EV",
)
assert(
  freshEvaluation.executionAdjustedProbability < freshEvaluation.conservativeFairProbability,
  "Stake probability must include the execution haircut",
)

const independentAnchor = analyzePositiveEV(
  [
    { outcome: "A", bookmaker: "book-a", decimal: minus110, lastUpdate: freshTime },
    { outcome: "B", bookmaker: "book-a", decimal: minus110, lastUpdate: freshTime },
    { outcome: "A", bookmaker: "book-b", decimal: minus110, lastUpdate: freshTime },
    { outcome: "B", bookmaker: "book-b", decimal: minus110, lastUpdate: freshTime },
    { outcome: "A", bookmaker: "book-c", decimal: minus110, lastUpdate: freshTime },
    { outcome: "B", bookmaker: "book-c", decimal: minus110, lastUpdate: freshTime },
    { outcome: "A", bookmaker: "book-d", decimal: minus110, lastUpdate: freshTime },
    { outcome: "B", bookmaker: "book-d", decimal: minus110, lastUpdate: freshTime },
  ],
  { asOf: freshTime, minConsensusBooks: 2 },
)
const correlatedAnchor = analyzePositiveEV(
  [
    { outcome: "A", bookmaker: "book-a", decimal: minus110, lastUpdate: freshTime },
    { outcome: "B", bookmaker: "book-a", decimal: minus110, lastUpdate: freshTime },
    { outcome: "A", bookmaker: "book-b", decimal: minus110, lastUpdate: freshTime },
    { outcome: "B", bookmaker: "book-b", decimal: minus110, lastUpdate: freshTime },
    { outcome: "A", bookmaker: "book-c", decimal: minus110, lastUpdate: freshTime },
    { outcome: "B", bookmaker: "book-c", decimal: minus110, lastUpdate: freshTime },
    { outcome: "A", bookmaker: "book-d", decimal: minus110, lastUpdate: freshTime },
    { outcome: "B", bookmaker: "book-d", decimal: minus110, lastUpdate: freshTime },
  ],
  {
    asOf: freshTime,
    minConsensusBooks: 2,
    bookmakerCorrelationGroups: {
      "book-a": "shared-feed",
      "book-b": "shared-feed",
    },
  },
)
assert(independentAnchor !== null && correlatedAnchor !== null, "Expected both anchors")
assert(
  correlatedAnchor.anchor.effectiveBookCount < independentAnchor.anchor.effectiveBookCount,
  "Correlated books must not count as fully independent opinions",
)

assertClose(staleTarget.kellyStakeFraction, 0)
assert(
  staleAnalysis.booksQuoting === 1,
  "Books quoting should count only valid anchor contributors, not stale complete books",
)

console.log("edge.v3-hardening.test.ts: all assertions passed")

const correlatedOnlyConsensus = analyzePositiveEV(
  [
    { outcome: "A", bookmaker: "clone-a", decimal: minus110, lastUpdate: freshTime },
    { outcome: "B", bookmaker: "clone-a", decimal: minus110, lastUpdate: freshTime },
    { outcome: "A", bookmaker: "clone-b", decimal: minus110, lastUpdate: freshTime },
    { outcome: "B", bookmaker: "clone-b", decimal: minus110, lastUpdate: freshTime },
    { outcome: "A", bookmaker: "clone-c", decimal: minus110, lastUpdate: freshTime },
    { outcome: "B", bookmaker: "clone-c", decimal: minus110, lastUpdate: freshTime },
  ],
  {
    asOf: freshTime,
    minConsensusBooks: 2,
    bookmakerCorrelationGroups: {
      "clone-a": "one-feed",
      "clone-b": "one-feed",
      "clone-c": "one-feed",
    },
  },
)
assert(
  correlatedOnlyConsensus === null,
  "A cluster of cloned books must not satisfy the independent consensus minimum",
)

const clusteredOutliers = analyzePositiveEV(
  [
    { outcome: "A", bookmaker: "independent", decimal: minus110, lastUpdate: freshTime },
    { outcome: "B", bookmaker: "independent", decimal: minus110, lastUpdate: freshTime },
    { outcome: "A", bookmaker: "clone-a", decimal: 1.55, lastUpdate: freshTime },
    { outcome: "B", bookmaker: "clone-a", decimal: 2.75, lastUpdate: freshTime },
    { outcome: "A", bookmaker: "clone-b", decimal: 1.55, lastUpdate: freshTime },
    { outcome: "B", bookmaker: "clone-b", decimal: 2.75, lastUpdate: freshTime },
    { outcome: "A", bookmaker: "clone-c", decimal: 1.55, lastUpdate: freshTime },
    { outcome: "B", bookmaker: "clone-c", decimal: 2.75, lastUpdate: freshTime },
  ],
  {
    asOf: freshTime,
    minConsensusBooks: 2,
    minimumOverround: 0.8,
    bookmakerCorrelationGroups: {
      "clone-a": "one-feed",
      "clone-b": "one-feed",
      "clone-c": "one-feed",
    },
    correlationGroupWeightCap: 1,
  },
)
assert(clusteredOutliers !== null, "Two independent groups should form consensus")
const clusteredProbability = clusteredOutliers.anchor.probabilities.find(
  (probability) => probability.outcome === "A",
)?.probability
assert(clusteredProbability !== undefined, "Expected clustered anchor probability")
assert(
  clusteredProbability > 0.4,
  "Cloned outlier prices must not overwhelm the independent market opinion",
)

console.log("edge.v3-correlation.test.ts: all assertions passed")

const pointMarketQuotes = [
  {
    outcome: "Over",
    bookmaker: "pinnacle",
    decimal: minus110,
    market: "totals" as const,
    point: 220.5,
    lastUpdate: freshTime,
  },
  {
    outcome: "Under",
    bookmaker: "pinnacle",
    decimal: minus110,
    market: "totals" as const,
    point: 220.5,
    lastUpdate: freshTime,
  },
  {
    outcome: "Over",
    bookmaker: "draftkings",
    decimal: 2.1,
    market: "totals" as const,
    point: 222.5,
    lastUpdate: freshTime,
  },
  {
    outcome: "Under",
    bookmaker: "draftkings",
    decimal: 1.8,
    market: "totals" as const,
    point: 222.5,
    lastUpdate: freshTime,
  },
]
assert(
  analyzePositiveEV(pointMarketQuotes, { asOf: freshTime }) === null,
  "The h2h edge engine must fail closed for point-bearing totals",
)

assert(
  analyzePositiveEV(
    [
      {
        outcome: "Alpha",
        bookmaker: "pinnacle",
        decimal: minus110,
        market: "h2h",
        lastUpdate: freshTime,
      },
      {
        outcome: "Beta",
        bookmaker: "pinnacle",
        decimal: minus110,
        market: "h2h",
        lastUpdate: freshTime,
      },
      {
        outcome: "Alpha",
        bookmaker: "draftkings",
        decimal: 2.1,
        market: "h2h",
        point: 0,
        lastUpdate: freshTime,
      },
      {
        outcome: "Beta",
        bookmaker: "draftkings",
        decimal: 1.8,
        market: "h2h",
        lastUpdate: freshTime,
      },
    ],
    { asOf: freshTime },
  ) === null,
  "Any point metadata must make the h2h edge engine fail closed",
)

console.log("edge.v3-point-market-safety.test.ts: all assertions passed")
