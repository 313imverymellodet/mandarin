import {
  isAsianQuarterLine,
  parseScore,
  settleH2HWager,
  settleMiddlePosition,
  settlePointLeg,
  splitAsianPoint,
  type FinalScore,
} from "./settlement-math"

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function close(actual: number | null, expected: number, tolerance = 1e-9): void {
  assert(actual !== null, "Expected a numeric result")
  assert(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`)
}

const score: FinalScore = {
  homeTeam: "Detroit",
  awayTeam: "Chicago",
  homeScore: 105,
  awayScore: 100,
}

const homeWin = settleH2HWager({
  outcome: "Detroit",
  marketOutcomes: ["Detroit", "Chicago"],
  decimal: 2.1,
  score,
})
assert(homeWin.status === "win" && homeWin.won === true, "Home moneyline should win")
close(homeWin.realizedReturn, 1.1)

const awayLoss = settleH2HWager({
  outcome: "Chicago",
  marketOutcomes: ["Detroit", "Chicago"],
  decimal: 1.8,
  score,
})
assert(awayLoss.status === "loss" && awayLoss.won === false, "Away moneyline should lose")
close(awayLoss.realizedReturn, -1)

const tied: FinalScore = { ...score, homeScore: 2, awayScore: 2 }
assert(
  settleH2HWager({ outcome: "Draw", marketOutcomes: ["Detroit", "Draw", "Chicago"], decimal: 3.4, score: tied }).status === "win",
  "Draw should win a three-way tied match",
)
assert(
  settleH2HWager({ outcome: "Detroit", marketOutcomes: ["Detroit", "Draw", "Chicago"], decimal: 2.1, score: tied }).status === "loss",
  "A team should lose when Draw is a quoted outcome",
)
assert(
  settleH2HWager({ outcome: "Detroit", marketOutcomes: ["Detroit", "Chicago"], decimal: 2.1, score: tied }).status === "push",
  "A two-way tied market should settle as a push",
)

assert(
  settlePointLeg({ market: "totals", outcome: "Over", point: 204.5, decimal: 1.91, stakeFraction: 0.5 }, score).status === "win",
  "205 should beat Over 204.5",
)
assert(
  settlePointLeg({ market: "totals", outcome: "Under", point: 205, decimal: 1.91, stakeFraction: 0.5 }, score).status === "push",
  "205 should push Under 205",
)

assert(isAsianQuarterLine(2.25), "2.25 should be an Asian quarter line")
assert(isAsianQuarterLine(-0.75), "-0.75 should be an Asian quarter line")
assert(splitAsianPoint(2.25).join(",") === "2,2.5", "Over 2.25 split is wrong")
assert(splitAsianPoint(-0.25).join(",") === "-0.5,0", "-0.25 split is wrong")
assert(splitAsianPoint(2.125).length === 0, "Eighth lines must fail closed")

const over225At2 = settlePointLeg(
  { market: "totals", outcome: "Over", point: 2.25, decimal: 1.92, stakeFraction: 1 },
  { ...score, homeScore: 1, awayScore: 1 },
)
assert(over225At2.status === "half_loss", "Over 2.25 at total 2 is half loss")
close(over225At2.realizedReturn, -0.5)

const under225At2 = settlePointLeg(
  { market: "totals", outcome: "Under", point: 2.25, decimal: 1.92, stakeFraction: 1 },
  { ...score, homeScore: 1, awayScore: 1 },
)
assert(under225At2.status === "half_win", "Under 2.25 at total 2 is half win")
close(under225At2.realizedReturn, 0.46)

const homePlus025Tie = settlePointLeg(
  { market: "spreads", outcome: "Detroit", point: 0.25, decimal: 1.9, stakeFraction: 1 },
  tied,
)
assert(homePlus025Tie.status === "half_win", "Home +0.25 on a tie is half win")
close(homePlus025Tie.realizedReturn, 0.45)

const totalMiddle = settleMiddlePosition({
  market: "totals",
  referenceOutcome: "Over",
  score: { ...score, homeScore: 111, awayScore: 110 },
  legs: [
    { market: "totals", outcome: "Over", point: 220.5, decimal: 1.91, stakeFraction: 0.5 },
    { market: "totals", outcome: "Under", point: 222.5, decimal: 1.91, stakeFraction: 0.5 },
  ],
})
assert(totalMiddle.status === "both_win" && totalMiddle.wonBoth === true, "221 should land the middle")
close(totalMiddle.realizedReturn, 0.91)
close(totalMiddle.finalReferenceValue, 221)

const outsideTotal = settleMiddlePosition({
  market: "totals",
  score: { ...score, homeScore: 113, awayScore: 112 },
  legs: [
    { market: "totals", outcome: "Over", point: 220.5, decimal: 1.91, stakeFraction: 0.5 },
    { market: "totals", outcome: "Under", point: 222.5, decimal: 1.91, stakeFraction: 0.5 },
  ],
})
assert(outsideTotal.status === "leg_a_win", "225 should win only the Over leg")
close(outsideTotal.realizedReturn, -0.045)

const pushMix = settleMiddlePosition({
  market: "totals",
  score: { ...score, homeScore: 110, awayScore: 110 },
  legs: [
    { market: "totals", outcome: "Over", point: 220, decimal: 1.91, stakeFraction: 0.5 },
    { market: "totals", outcome: "Under", point: 222, decimal: 1.91, stakeFraction: 0.5 },
  ],
})
assert(pushMix.status === "push_mix", "A push plus a win should be identified")
close(pushMix.realizedReturn, 0.455)

const spreadMiddle = settleMiddlePosition({
  market: "spreads",
  referenceOutcome: "Detroit",
  score: { ...score, homeScore: 100, awayScore: 103 },
  legs: [
    { market: "spreads", outcome: "Detroit", point: 3.5, decimal: 1.91, stakeFraction: 0.5 },
    { market: "spreads", outcome: "Chicago", point: -2.5, decimal: 1.91, stakeFraction: 0.5 },
  ],
})
assert(spreadMiddle.status === "both_win", "Home +3.5 and away -2.5 should both win at a 3-point away win")
close(spreadMiddle.finalReferenceValue, -3)

assert(parseScore("113") === 113, "String score should parse")
assert(parseScore("not-a-score") === null, "Invalid score should return null")
assert(parseScore(-1) === null, "Negative score should fail closed")
assert(
  settlePointLeg(
    { market: "totals", outcome: "Over", point: 10.5, decimal: 1.9, stakeFraction: 1 },
    { ...score, homeScore: -1 },
  ).status === "unknown",
  "Negative final scores must not settle",
)

console.log("settlement-math.test.ts: all assertions passed")
