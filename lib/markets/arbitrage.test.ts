import {
  americanToDecimal,
  buildArbitrageStakePlan,
  calculateArbitrageEdgePct,
  decimalToAmerican,
  findBestArbitrage,
  findBestLines,
  stakeSplit,
  validateArbitrageExecution,
  type OutcomeQuote,
} from "./arbitrage"

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function close(actual: number, expected: number, tolerance = 1e-9): void {
  assert(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`)
}

close(americanToDecimal(-110), 100 / 110 + 1)
close(americanToDecimal(110), 2.1)
assert(decimalToAmerican(2.1) === 110, "2.10 should be +110")
assert(decimalToAmerican(100 / 110 + 1) === -110, "-110 conversion should round-trip")

const basic: OutcomeQuote[] = [
  { outcome: "A", bookmaker: "book-a", decimal: 2.1 },
  { outcome: "B", bookmaker: "book-b", decimal: 2.1 },
]
const basicArb = findBestArbitrage(basic)
assert(basicArb !== null, "Expected a two-way arb")
close(basicArb.edgePct, (1 - 2 / 2.1) * 100)
close(basicArb.guaranteedRoiPct, (2.1 / 2 - 1) * 100)

const threeWay = findBestArbitrage([
  { outcome: "Home", bookmaker: "a", decimal: 3.5 },
  { outcome: "Draw", bookmaker: "b", decimal: 3.6 },
  { outcome: "Away", bookmaker: "c", decimal: 3.7 },
])
assert(threeWay !== null && threeWay.legs.length === 3, "Expected a three-way arb")
assert(threeWay.edgePct > 0, "Three-way edge should be positive")

// Outcome labels are case-insensitive, and duplicate prices use the better line.
const caseDeduped = findBestLines([
  { outcome: " Alpha ", bookmaker: "one", decimal: 2.02 },
  { outcome: "alpha", bookmaker: "two", decimal: 2.08 },
  { outcome: "BETA", bookmaker: "three", decimal: 2.05 },
])
assert(caseDeduped !== null && caseDeduped.legs.length === 2, "Expected normalized outcomes")
assert(caseDeduped.legs.some((leg) => leg.bookmaker === "two"), "Expected best Alpha price")

// The engine enumerates combinations. A stale top line should not hide a fresh,
// slightly lower line that is still a valid arbitrage.
const asOf = "2026-07-30T14:00:00.000Z"
const freshCombo = findBestArbitrage(
  [
    { outcome: "A", bookmaker: "stale", decimal: 2.3, lastUpdate: "2026-07-30T13:50:00.000Z" },
    { outcome: "A", bookmaker: "fresh-a", decimal: 2.08, lastUpdate: "2026-07-30T13:59:40.000Z" },
    { outcome: "B", bookmaker: "fresh-b", decimal: 2.08, lastUpdate: "2026-07-30T13:59:45.000Z" },
  ],
  {
    asOf,
    requireQuoteTimestamps: true,
    maxQuoteAgeSeconds: 60,
    maxQuoteSkewSeconds: 30,
  },
)
assert(freshCombo !== null, "Expected the fresh executable combination")
assert(!freshCombo.legs.some((leg) => leg.bookmaker === "stale"), "Stale leg must be excluded")

// Same-book legs are not considered executable by default.
assert(
  findBestArbitrage([
    { outcome: "A", bookmaker: "same", decimal: 2.2 },
    { outcome: "B", bookmaker: "same", decimal: 2.2 },
  ]) === null,
  "Actionable arbitrage should require different books",
)

// Alternate total lines must never be mixed into a fake arb.
const noMixedTotals = findBestArbitrage([
  { market: "totals", outcome: "Over", point: 220.5, bookmaker: "a", decimal: 2.1 },
  { market: "totals", outcome: "Under", point: 222.5, bookmaker: "b", decimal: 2.1 },
])
assert(noMixedTotals === null, "Different total points are a middle, not an arb")

// Matching spread points are grouped by absolute line value.
const spreadArb = findBestArbitrage([
  { market: "spreads", outcome: "Home", point: -3.5, bookmaker: "a", decimal: 2.1 },
  { market: "spreads", outcome: "Away", point: 3.5, bookmaker: "b", decimal: 2.1 },
])
assert(spreadArb !== null && spreadArb.market === "spreads", "Expected a true same-line spread arb")

// A tiny positive edge is not destroyed by presentation rounding.
const tiny = calculateArbitrageEdgePct([2.0002, 2.0002])
assert(tiny > 0 && tiny < 0.02, "Expected a small precise edge")
assert(
  findBestArbitrage(
    [
      { outcome: "A", bookmaker: "a", decimal: 2.0002 },
      { outcome: "B", bookmaker: "b", decimal: 2.0002 },
    ],
    { minimumEdgePct: tiny / 2 },
  ) !== null,
  "Precise edge should pass without early rounding",
)

// Haircut stress can reject a fragile headline arb.
assert(
  findBestArbitrage(basic, { decimalHaircutFraction: 0.10 }) === null,
  "A fragile arb should fail a sufficiently large odds haircut",
)

const validation = validateArbitrageExecution(
  [
    { outcome: "A", bookmaker: "a", decimal: 2.1, lastUpdate: "2026-07-30T13:59:59.000Z" },
    { outcome: "B", bookmaker: "b", decimal: 2.1, lastUpdate: "2026-07-30T13:58:00.000Z" },
  ],
  { asOf, requireQuoteTimestamps: true, maxQuoteAgeSeconds: 180, maxQuoteSkewSeconds: 30 },
)
assert(!validation.executable, "Large target quote skew should block execution")
assert(validation.reasons.includes("quote_skew_too_large"), "Expected quote skew reason")

const fractions = stakeSplit(basic)
close(fractions[0] ?? Number.NaN, 0.5)
close(fractions[1] ?? Number.NaN, 0.5)

const plan = buildArbitrageStakePlan(basic, 100, 2, 1)
assert(plan !== null, "Expected a stake plan")
close(plan.legs.reduce((sum, leg) => sum + leg.stake, 0), 100)
assert(plan.guaranteedProfit > 0, "Arb plan should guarantee profit")
assert(plan.payoutSpread <= 0.02, "Executable payouts should be nearly equal")
assert(plan.legs.every((leg) => leg.breakEvenDecimal < leg.quote.decimal), "Each leg needs price cushion")

// Verify the maximin allocator against exhaustive search for a small two-way bank.
const uneven: OutcomeQuote[] = [
  { outcome: "A", bookmaker: "a", decimal: 2.35 },
  { outcome: "B", bookmaker: "b", decimal: 1.83 },
]
const unevenBankroll = 50
const unevenPlan = buildArbitrageStakePlan(uneven, unevenBankroll, 0)
assert(unevenPlan !== null, "Expected profitable integer-unit plan")
let exhaustiveBest = Number.NEGATIVE_INFINITY
for (let a = 1; a < unevenBankroll; a += 1) {
  const b = unevenBankroll - a
  exhaustiveBest = Math.max(exhaustiveBest, Math.min(Math.floor(a * 2.35), Math.floor(b * 1.83)))
}
close(unevenPlan.guaranteedGrossReturn, exhaustiveBest)

console.log("arbitrage.test.ts: all assertions passed")

// Exactly fair complementary prices are not an arbitrage.
assert(
  findBestArbitrage([
    { outcome: "A", bookmaker: "a", decimal: 2 },
    { outcome: "B", bookmaker: "b", decimal: 2 },
  ]) === null,
  "Zero-edge prices must not be promoted as arbitrage",
)

// Same absolute spread is not enough: the two points must be complementary.
assert(
  findBestArbitrage([
    { market: "spreads", outcome: "Home", point: -3.5, bookmaker: "a", decimal: 2.2 },
    { market: "spreads", outcome: "Away", point: -3.5, bookmaker: "b", decimal: 2.2 },
  ]) === null,
  "Two same-sign spread points are not one settlement market",
)

// Totals must be Over/Under rather than arbitrary labels.
assert(
  findBestArbitrage([
    { market: "totals", outcome: "Yes", point: 220.5, bookmaker: "a", decimal: 2.2 },
    { market: "totals", outcome: "No", point: 220.5, bookmaker: "b", decimal: 2.2 },
  ]) === null,
  "Totals require complementary Over and Under outcomes",
)

// A stale provider duplicate must not displace a fresh executable quote from
// the same book/outcome/line merely because its displayed odds are higher.
const freshDuplicate = findBestArbitrage(
  [
    { outcome: "A", bookmaker: "book-a", decimal: 2.3, lastUpdate: "2026-07-30T13:40:00.000Z" },
    { outcome: "A", bookmaker: "book-a", decimal: 2.08, lastUpdate: "2026-07-30T13:59:45.000Z" },
    { outcome: "B", bookmaker: "book-b", decimal: 2.08, lastUpdate: "2026-07-30T13:59:50.000Z" },
  ],
  {
    asOf,
    requireQuoteTimestamps: true,
    maxQuoteAgeSeconds: 60,
    maxQuoteSkewSeconds: 30,
  },
)
assert(freshDuplicate !== null, "Fresh duplicate should survive deduplication")
assert(
  freshDuplicate.legs.find((leg) => leg.outcome === "A")?.decimal === 2.08,
  "The executable duplicate should be selected",
)

// Stake plans are only available for valid, positive-edge market structures.
assert(
  buildArbitrageStakePlan([
    { outcome: "A", bookmaker: "a", decimal: 1.9 },
    { outcome: "B", bookmaker: "b", decimal: 1.9 },
  ], 100) === null,
  "A negative-return hedge must not be labeled an arbitrage stake plan",
)
assert(
  buildArbitrageStakePlan([
    { outcome: "A", bookmaker: "a", decimal: 2 },
    { outcome: "B", bookmaker: "b", decimal: 2 },
  ], 100) === null,
  "A break-even hedge must not receive an arbitrage stake plan",
)
assert(
  buildArbitrageStakePlan([
    { outcome: "A", bookmaker: "a", decimal: 2.01 },
    { outcome: "B", bookmaker: "b", decimal: 2.01 },
  ], 1, 2) === null,
  "A theoretical arb that rounds to zero guaranteed currency profit must fail closed",
)

console.log("arbitrage.v3-hardening.test.ts: all assertions passed")
