import {
  buildProductionArbitrageOptions,
  buildProductionEdgeOptions,
  buildProductionMiddleOptions,
  PRODUCTION_PORTFOLIO_OPTIONS,
} from "./production-config"

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const asOf = "2026-07-30T14:00:00Z"
const eventTime = "2026-07-30T20:00:00Z"
const arb = buildProductionArbitrageOptions(asOf)
assert(arb.requireQuoteTimestamps === true, "Arbitrage timestamps are mandatory")
assert((arb.minimumEdgePct ?? 0) > 0, "Arbitrage needs an execution margin")
assert((arb.decimalHaircutFraction ?? 0) > 0, "Arbitrage needs stress testing")

const edge = buildProductionEdgeOptions({
  asOf,
  eventTime,
  eligibleBookmakers: ["draftkings", "fanduel"],
})
assert(edge.excludeTargetBookFromAnchor === true, "Target exclusion is mandatory")
assert((edge.minimumNetEv ?? 0) > 0, "Production edge requires buffered EV")
assert((edge.maximumKellyStakeFraction ?? 1) <= 0.01, "Per-position Kelly cap")

const candidateMiddle = buildProductionMiddleOptions({
  sportKey: "basketball_nba",
  asOf,
  eventTime,
  eligibleBookmakers: ["draftkings", "fanduel"],
  allowActionable: true,
})
assert(candidateMiddle.allowActionable === false, "No calibration ID means candidate-only")

const calibratedMiddle = buildProductionMiddleOptions({
  sportKey: "basketball_nba",
  asOf,
  eventTime,
  eligibleBookmakers: ["draftkings", "fanduel"],
  allowActionable: true,
  calibrationId: "nba-totals-held-out-2026q3-v1",
})
assert(calibratedMiddle.allowActionable === true, "Calibrated flag can enable middles")
assert(calibratedMiddle.calibrationId === "nba-totals-held-out-2026q3-v1", "Audit tag")

assert((PRODUCTION_PORTFOLIO_OPTIONS.maxTotalStakeFraction ?? 1) <= 0.05, "Portfolio cap")

console.log("production-config.test.ts: all assertions passed")
