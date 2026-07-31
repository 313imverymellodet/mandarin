import {
  allocatePortfolio,
  getDefaultPortfolioOptions,
  type PortfolioCandidate,
} from "./portfolio"

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function assertClose(actual: number, expected: number, tolerance = 1e-12): void {
  assert(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`)
}

function candidate(
  overrides: Partial<PortfolioCandidate> & Pick<PortfolioCandidate, "id" | "eventId">,
): PortfolioCandidate {
  return {
    id: overrides.id,
    eventId: overrides.eventId,
    league: overrides.league ?? "nba",
    marketKey: overrides.marketKey ?? "h2h",
    kind: overrides.kind ?? "positive_ev",
    requestedStakeFraction: overrides.requestedStakeFraction ?? 0.01,
    expectedReturn: overrides.expectedReturn ?? 0.03,
    confidence: overrides.confidence ?? 75,
    isActionable: overrides.isActionable ?? true,
    bookmakerExposures: overrides.bookmakerExposures ?? [
      { bookmaker: "draftkings", fraction: 1 },
    ],
    ...(overrides.expectedLogGrowth !== undefined
      ? { expectedLogGrowth: overrides.expectedLogGrowth }
      : {}),
    ...(overrides.outcomeKey !== undefined ? { outcomeKey: overrides.outcomeKey } : {}),
    ...(overrides.correlationKey !== undefined
      ? { correlationKey: overrides.correlationKey }
      : {}),
    ...(overrides.correlationTags !== undefined
      ? { correlationTags: overrides.correlationTags }
      : {}),
  }
}

const duplicatePlan = allocatePortfolio(
  [
    candidate({
      id: "weaker",
      eventId: "event-1",
      outcomeKey: "home",
      expectedReturn: 0.02,
      confidence: 70,
    }),
    candidate({
      id: "stronger",
      eventId: "event-1",
      outcomeKey: "home",
      expectedReturn: 0.04,
      confidence: 80,
    }),
  ],
  { maxPositionsPerEvent: 5 },
)
assert(duplicatePlan.allocations.length === 1, "Duplicate same-side signals must collapse")
assert(duplicatePlan.allocations[0]?.candidate.id === "stronger", "Keep strongest duplicate")
assert(
  duplicatePlan.rejections.some((rejection) => rejection.reason === "duplicate_correlation_key"),
  "Expected duplicate rejection",
)

const atomicMiddle = allocatePortfolio(
  [
    candidate({
      id: "middle-1",
      eventId: "event-middle",
      kind: "middle",
      requestedStakeFraction: 0.01,
      bookmakerExposures: [
        { bookmaker: "book-a", fraction: 0.6 },
        { bookmaker: "book-b", fraction: 0.4 },
      ],
    }),
  ],
  {
    maxStakeFractionByKind: { middle: 0.01 },
    maxPerBookStakeFraction: 0.003,
  },
)
assert(atomicMiddle.allocations.length === 1, "Middle should be scaled atomically")
const middleAllocation = atomicMiddle.allocations[0]
assert(middleAllocation !== undefined, "Expected middle allocation")
// book-a is the binding leg: 0.003 / 0.6 = 0.005 total position.
assertClose(middleAllocation.allocatedStakeFraction, 0.005)
assertClose(middleAllocation.bookmakerStakeFractions[0]?.stakeFraction ?? NaN, 0.003)
assertClose(middleAllocation.bookmakerStakeFractions[1]?.stakeFraction ?? NaN, 0.002)

const capPlan = allocatePortfolio(
  [
    candidate({ id: "a", eventId: "e-a", requestedStakeFraction: 0.01 }),
    candidate({ id: "b", eventId: "e-b", requestedStakeFraction: 0.01, expectedReturn: 0.025 }),
    candidate({ id: "c", eventId: "e-c", requestedStakeFraction: 0.01, expectedReturn: 0.02 }),
  ],
  {
    maxTotalStakeFraction: 0.02,
    maxPerBookStakeFraction: 0.02,
    maxPerLeagueStakeFraction: 0.02,
  },
)
assertClose(capPlan.totalStakeFraction, 0.02)
assert(capPlan.allocations.length === 2, "Total cap should stop the third position")
assert(
  capPlan.rejections.some((rejection) => rejection.reason === "portfolio_capacity_exhausted"),
  "Expected capacity rejection",
)

const eventLimit = allocatePortfolio(
  [
    candidate({ id: "event-best", eventId: "same", expectedReturn: 0.04, outcomeKey: "home" }),
    candidate({ id: "event-second", eventId: "same", expectedReturn: 0.03, outcomeKey: "away" }),
  ],
  { deduplicateCorrelationKeys: false, maxPositionsPerEvent: 1 },
)
assert(eventLimit.allocations.length === 1, "Default event concentration should be limited")
assert(eventLimit.allocations[0]?.candidate.id === "event-best", "Best event position wins")
assert(
  eventLimit.rejections.some((rejection) => rejection.reason === "event_position_limit"),
  "Expected event limit rejection",
)

const rejected = allocatePortfolio([
  candidate({ id: "not-live", eventId: "x", isActionable: false }),
  candidate({ id: "invalid", eventId: "y", requestedStakeFraction: -1 }),
])
assert(rejected.allocations.length === 0, "Rejected/invalid signals must never receive stake")
assert(rejected.rejections.length === 2, "Expected both rejection records")

const nonPositive = allocatePortfolio([
  candidate({ id: "zero-ev", eventId: "zero", expectedReturn: 0 }),
  candidate({ id: "negative-ev", eventId: "negative", expectedReturn: -0.01 }),
])
assert(nonPositive.allocations.length === 0, "Non-positive buffered EV must not consume bankroll")
assert(
  nonPositive.rejections.every(
    (rejection) => rejection.reason === "expected_return_below_threshold",
  ),
  "Expected explicit non-positive-return rejection reasons",
)

const thresholded = allocatePortfolio(
  [
    candidate({ id: "below-floor", eventId: "floor-a", expectedReturn: 0.004 }),
    candidate({ id: "above-floor", eventId: "floor-b", expectedReturn: 0.006 }),
  ],
  { minimumExpectedReturn: 0.005 },
)
assert(thresholded.allocations.length === 1, "Expected-return floor should filter weak positions")
assert(thresholded.allocations[0]?.candidate.id === "above-floor", "Keep the position above the floor")

const source = [
  candidate({ id: "det-b", eventId: "det-b", expectedReturn: 0.02 }),
  candidate({ id: "det-a", eventId: "det-a", expectedReturn: 0.03 }),
]
const serialized = JSON.stringify(source)
const first = allocatePortfolio(source, { maxPerBookStakeFraction: 0.02 })
const second = allocatePortfolio([...source].reverse(), { maxPerBookStakeFraction: 0.02 })
assert(JSON.stringify(source) === serialized, "Allocator must not mutate input")
assert(
  first.allocations.map((allocation) => allocation.candidate.id).join(",") ===
    second.allocations.map((allocation) => allocation.candidate.id).join(","),
  "Allocation order must be deterministic across input permutations",
)

const defaults = getDefaultPortfolioOptions()
assert(defaults.maxTotalStakeFraction === 0.05, "Documented default total cap")
assert(defaults.maxStakeFractionByKind.middle < defaults.maxStakeFractionByKind.positive_ev,
  "Uncalibrated middles should have the smallest default cap")

console.log("portfolio.test.ts: all assertions passed")
