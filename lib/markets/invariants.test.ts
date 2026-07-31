import {
  buildArbitrageStakePlan,
  calculateArbitrageEdgePct,
  findBestArbitrage,
  stakeSplit,
  type OutcomeQuote,
} from "./arbitrage"
import { devigPower, devigProportional, devigShin } from "./edge"
import {
  discreteConditionalWinProbabilityAbove,
  inferDiscreteNormalMeanFromConditionalWin,
  normalCdf,
  normalInv,
  truncatedDiscreteConditionalWinProbabilityAbove,
  inferTruncatedDiscreteNormalMeanFromConditionalWin,
  buildMiddleStakePlan,
  type PointOutcomeQuote,
} from "./middles"
import { allocatePortfolio, type PortfolioCandidate } from "./portfolio"

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function close(actual: number, expected: number, tolerance = 1e-8): void {
  assert(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`)
}

let state = 0x6d616e64
function random(): number {
  state = (Math.imul(state, 1664525) + 1013904223) >>> 0
  return state / 0x1_0000_0000
}
function between(minimum: number, maximum: number): number {
  return minimum + random() * (maximum - minimum)
}

for (let iteration = 0; iteration < 5_000; iteration += 1) {
  const count = random() < 0.5 ? 2 : 3
  const decimals = Array.from({ length: count }, () => between(1.05, 12))
  for (const result of [
    devigProportional(decimals),
    devigPower(decimals),
    devigShin(decimals),
  ]) {
    if (result === null) continue
    close(result.reduce((sum, probability) => sum + probability, 0), 1, 1e-7)
    assert(result.every((probability) => probability >= 0 && probability <= 1), "Probability simplex")
  }
}

for (let iteration = 0; iteration < 400; iteration += 1) {
  const count = random() < 0.75 ? 2 : 3
  const legs: OutcomeQuote[] = Array.from({ length: count }, (_, index) => ({
    outcome: `side-${index}`,
    bookmaker: `book-${index}`,
    decimal: between(1.25, 7),
  }))
  const fractions = stakeSplit(legs)
  assert(fractions.length === count, "Valid odds must produce stake fractions")
  close(fractions.reduce((sum, fraction) => sum + fraction, 0), 1)

  const preciseEdge = calculateArbitrageEdgePct(legs.map((leg) => leg.decimal))
  const found = findBestArbitrage(legs)
  assert((found !== null) === (preciseEdge > 1e-10), "Arbitrage promotion must match exact edge sign")

  if (preciseEdge <= 1e-10) continue
  const totalUnits = count === 2
    ? 2 + Math.floor(random() * 24)
    : 3 + Math.floor(random() * 13)
  let exhaustive = Number.NEGATIVE_INFINITY
  if (count === 2) {
    for (let a = 1; a < totalUnits; a += 1) {
      exhaustive = Math.max(
        exhaustive,
        Math.min(
          Math.floor(a * legs[0]!.decimal + 1e-12),
          Math.floor((totalUnits - a) * legs[1]!.decimal + 1e-12),
        ),
      )
    }
  } else {
    for (let a = 1; a < totalUnits - 1; a += 1) {
      for (let b = 1; b < totalUnits - a; b += 1) {
        const c = totalUnits - a - b
        exhaustive = Math.max(
          exhaustive,
          Math.min(
            Math.floor(a * legs[0]!.decimal + 1e-12),
            Math.floor(b * legs[1]!.decimal + 1e-12),
            Math.floor(c * legs[2]!.decimal + 1e-12),
          ),
        )
      }
    }
  }

  const plan = buildArbitrageStakePlan(legs, totalUnits, 0)
  if (exhaustive <= totalUnits) {
    assert(
      plan === null,
      "A theoretical arb with no positive integer-unit profit must fail closed",
    )
  } else {
    assert(plan !== null, "Executable positive arb must produce an integer plan")
    close(plan.guaranteedGrossReturn, exhaustive)
  }
}

for (let iteration = 0; iteration < 1_000; iteration += 1) {
  const p = between(0.0001, 0.9999)
  close(normalCdf(normalInv(p)), p, 2e-7)

  const threshold = Math.round(between(-30, 300) * 2) / 2
  const sigma = between(0.5, 40)
  const mean = between(threshold - 3 * sigma, threshold + 3 * sigma)
  const untruncated = discreteConditionalWinProbabilityAbove(threshold, mean, sigma)
  if (untruncated > 1e-5 && untruncated < 1 - 1e-5) {
    const inferred = inferDiscreteNormalMeanFromConditionalWin(threshold, untruncated, sigma)
    close(inferred, mean, 1e-5)
  }

  const totalThreshold = Math.max(0, threshold)
  const totalMean = Math.max(0, mean)
  const truncated = truncatedDiscreteConditionalWinProbabilityAbove(totalThreshold, totalMean, sigma)
  if (truncated > 1e-5 && truncated < 1 - 1e-5) {
    const inferred = inferTruncatedDiscreteNormalMeanFromConditionalWin(
      totalThreshold,
      truncated,
      sigma,
    )
    close(inferred, totalMean, 1e-5)
  }
}


for (let iteration = 0; iteration < 1_000; iteration += 1) {
  const decimalA = between(1.55, 3.5)
  const decimalB = between(1.55, 3.5)
  const totalUnits = 2 + Math.floor(random() * 80)
  const quoteA: PointOutcomeQuote = {
    outcome: "Over",
    bookmaker: "book-a",
    decimal: decimalA,
    market: "totals",
    point: 220.5,
  }
  const quoteB: PointOutcomeQuote = {
    outcome: "Under",
    bookmaker: "book-b",
    decimal: decimalB,
    market: "totals",
    point: 222.5,
  }

  let exhaustiveWorstOutside = Number.NEGATIVE_INFINITY
  let exhaustiveImbalance = Number.POSITIVE_INFINITY
  let exhaustiveBothWin = Number.NEGATIVE_INFINITY
  for (let unitsA = 1; unitsA < totalUnits; unitsA += 1) {
    const unitsB = totalUnits - unitsA
    const grossA = Math.floor(unitsA * decimalA + 1e-12)
    const grossB = Math.floor(unitsB * decimalB + 1e-12)
    const oneA = grossA - totalUnits
    const oneB = grossB - totalUnits
    const worst = Math.min(oneA, oneB)
    const imbalance = Math.abs(oneA - oneB)
    const bothWin = grossA + grossB - totalUnits
    if (
      worst > exhaustiveWorstOutside ||
      (worst === exhaustiveWorstOutside && imbalance < exhaustiveImbalance) ||
      (worst === exhaustiveWorstOutside &&
        imbalance === exhaustiveImbalance &&
        bothWin > exhaustiveBothWin)
    ) {
      exhaustiveWorstOutside = worst
      exhaustiveImbalance = imbalance
      exhaustiveBothWin = bothWin
    }
  }

  const plan = buildMiddleStakePlan(quoteA, quoteB, totalUnits, 0)
  assert(plan !== null, "Valid middle quotes must produce a rounded stake plan")
  close(plan.worstOutsideProfit, exhaustiveWorstOutside)
  close(plan.payoutImbalance, exhaustiveImbalance)
  close(plan.bothWinProfit, exhaustiveBothWin)
}

const randomCandidates: PortfolioCandidate[] = Array.from({ length: 100 }, (_, index) => ({
  id: `position-${index}`,
  eventId: `event-${index % 20}`,
  league: `league-${index % 4}`,
  marketKey: "h2h",
  kind: "positive_ev",
  requestedStakeFraction: between(0.001, 0.02),
  expectedReturn: between(0.005, 0.08),
  confidence: between(55, 95),
  isActionable: true,
  outcomeKey: `side-${index % 2}`,
  correlationTags: [`team-${index % 12}`],
  bookmakerExposures: [{ bookmaker: `book-${index % 8}`, fraction: 1 }],
}))
const portfolio = allocatePortfolio(randomCandidates)
assert(portfolio.totalStakeFraction <= 0.05 + 1e-12, "Total portfolio cap")
assert(Object.values(portfolio.bookExposureFractions).every((value) => value <= 0.025 + 1e-12), "Book cap")
assert(Object.values(portfolio.eventExposureFractions).every((value) => value <= 0.015 + 1e-12), "Event cap")
assert(Object.values(portfolio.leagueExposureFractions).every((value) => value <= 0.03 + 1e-12), "League cap")
assert(Object.values(portfolio.correlationTagExposureFractions).every((value) => value <= 0.015 + 1e-12), "Tag cap")

console.log("invariants.test.ts: all randomized invariants passed")
