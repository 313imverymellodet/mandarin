import {
  analyzePositiveEV,
  devigProportional,
  expectedValue,
  findBestPositiveEV,
  fractionalKellyStake,
  findBestSpreadMiddle,
  findBestTotalsMiddle,
} from "./edge"

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function assertClose(actual: number, expected: number, tolerance = 1e-9): void {
  assert(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`)
}

const minus110 = 100 / 110 + 1
const fair = devigProportional([minus110, minus110])
assert(fair !== null, "Expected a valid two-way de-vig")
assertClose(fair[0] ?? NaN, 0.5)
assertClose(fair[1] ?? NaN, 0.5)

assertClose(expectedValue(2.1, 0.5) ?? NaN, 0.05)
assertClose(fractionalKellyStake(2.1, 0.5, 1), 0.04545454545454549)
assertClose(fractionalKellyStake(2.1, 0.5), 0.011363636363636373)
assertClose(fractionalKellyStake(1.8, 0.5), 0)

const quotes = [
  { outcome: "Alpha", bookmaker: "pinnacle", decimal: minus110 },
  { outcome: "Beta", bookmaker: "pinnacle", decimal: minus110 },
  { outcome: "Alpha", bookmaker: "draftkings", decimal: 2.1 },
  { outcome: "Beta", bookmaker: "draftkings", decimal: 1.8 },
] as const

const best = findBestPositiveEV(quotes, {
  eligibleBookmakers: ["draftkings"],
  eventTime: "2026-07-15T00:00:00Z",
  asOf: "2026-07-14T20:00:00Z",
})
assert(best !== null, "Expected a +EV opportunity")
assert(best.outcome === "Alpha", "Expected Alpha")
assert(best.bookmaker === "draftkings", "Expected DraftKings")
assertClose(best.fairProbability, 0.5)
assertClose(best.ev, 0.05)
assertClose(best.evPct, 5)

const consensus = analyzePositiveEV([
  { outcome: "Home", bookmaker: "book-a", decimal: 1.91 },
  { outcome: "Away", bookmaker: "book-a", decimal: 1.91 },
  { outcome: "Home", bookmaker: "book-b", decimal: 1.95 },
  { outcome: "Away", bookmaker: "book-b", decimal: 1.87 },
  { outcome: "Home", bookmaker: "book-c", decimal: 2.1 },
  { outcome: "Away", bookmaker: "book-c", decimal: 1.75 },
])
assert(consensus !== null, "Expected consensus analysis")
assert(consensus.anchor.source === "consensus", "Expected consensus anchor")
assert(consensus.anchor.contributingBookmakers.length === 3, "Expected three books")

assert(
  findBestPositiveEV([
    { outcome: "A", bookmaker: "one-soft-book", decimal: 2.2 },
    { outcome: "B", bookmaker: "one-soft-book", decimal: 1.7 },
  ]) === null,
  "A single non-sharp book must not anchor fair value",
)

const threeWay = devigProportional([2, 3, 4])
assert(threeWay !== null, "Expected a valid three-way de-vig")
assertClose(threeWay[0] ?? NaN, 6 / 13)
assertClose(threeWay[1] ?? NaN, 4 / 13)
assertClose(threeWay[2] ?? NaN, 3 / 13)
assertClose(threeWay.reduce((sum, probability) => sum + probability, 0), 1)

assert(
  findBestPositiveEV([
    { outcome: "Only Side", bookmaker: "pinnacle", decimal: 2 },
    { outcome: "Only Side", bookmaker: "draftkings", decimal: 2.1 },
  ]) === null,
  "One-sided data must return null",
)

assert(
  findBestPositiveEV([
    { outcome: "A", bookmaker: "pinnacle", decimal: 1.91 },
    { outcome: "B", bookmaker: "pinnacle", decimal: 1.91 },
    { outcome: "A", bookmaker: "one-sided-soft-book", decimal: 2.2 },
  ]) === null,
  "An incomplete candidate book must be ignored",
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
