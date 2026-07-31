const EPSILON = 1e-9

/** Result of one wager after an event is final. */
export type WagerSettlementStatus =
  | "win"
  | "half_win"
  | "push"
  | "half_loss"
  | "loss"
  | "unknown"

/** Final two-team score normalized from the provider response. */
export interface FinalScore {
  homeTeam: string
  awayTeam: string
  homeScore: number
  awayScore: number
}

/** Settlement result for a one-unit wager. */
export interface WagerSettlement {
  status: WagerSettlementStatus
  /** Net return per one unit staked. */
  realizedReturn: number | null
  /** Null represents a push or an outcome that could not be settled safely. */
  won: boolean | null
  /** Quarter Asian lines are represented as their two half-stake components. */
  componentStatuses?: readonly WagerSettlementStatus[]
}

/** Input needed to settle a two-way or three-way h2h wager. */
export interface H2HSettlementInput {
  outcome: string
  marketOutcomes?: readonly string[] | null
  decimal: number
  score: FinalScore
}

/** One leg of a spread or total middle. */
export interface PointLegSettlementInput {
  market: "spreads" | "totals"
  outcome: string
  point: number
  decimal: number
  stakeFraction: number
}

/** Input needed to settle an entire two-leg middle position. */
export interface MiddlePositionSettlementInput {
  market: "spreads" | "totals"
  referenceOutcome?: string | null
  score: FinalScore
  legs: readonly [PointLegSettlementInput, PointLegSettlementInput]
}

export interface MiddlePositionSettlement {
  status:
    | "both_win"
    | "leg_a_win"
    | "leg_b_win"
    | "both_loss"
    | "push_mix"
    | "partial_mix"
    | "unknown"
  legStatuses: readonly [WagerSettlementStatus, WagerSettlementStatus]
  finalReferenceValue: number | null
  wonBoth: boolean | null
  /** Net return across the complete position, where total initial stake = 1. */
  realizedReturn: number | null
}

/**
 * Settle a two-way or three-way h2h wager. Team names are matched
 * case-insensitively; common Draw/Tie labels are supported for soccer.
 */
export function settleH2HWager(input: H2HSettlementInput): WagerSettlement {
  if (!isValidDecimal(input.decimal) || !validScore(input.score)) return unknownSettlement()

  const outcome = normalizeLabel(input.outcome)
  const home = normalizeLabel(input.score.homeTeam)
  const away = normalizeLabel(input.score.awayTeam)
  const isTie = almostEqual(input.score.homeScore, input.score.awayScore)
  const outcomes = (input.marketOutcomes ?? []).map(normalizeLabel)
  const drawIsQuoted = outcomes.some(isDrawLabel) || isDrawLabel(outcome)

  if (isDrawLabel(outcome)) return wagerResult(isTie ? "win" : "loss", input.decimal)
  if (outcome !== home && outcome !== away) return unknownSettlement()

  if (isTie) {
    // A team loses in a three-way market with Draw. A standard two-way market
    // pushes on a tie unless the caller knows the book's house rules differ.
    return wagerResult(drawIsQuoted ? "loss" : "push", input.decimal)
  }

  const homeWon = input.score.homeScore > input.score.awayScore
  const selectedWon = outcome === home ? homeWon : !homeWon
  return wagerResult(selectedWon ? "win" : "loss", input.decimal)
}

/**
 * Settle one spread or total leg. Full, half, and Asian quarter lines are
 * supported. Quarter lines are split into two equal component wagers, e.g.
 * Over 2.25 = half Over 2.0 plus half Over 2.5.
 */
export function settlePointLeg(
  leg: PointLegSettlementInput,
  score: FinalScore,
): WagerSettlement {
  if (
    !validScore(score) ||
    !isValidDecimal(leg.decimal) ||
    !Number.isFinite(leg.point) ||
    !Number.isFinite(leg.stakeFraction) ||
    leg.stakeFraction < 0
  ) {
    return unknownSettlement()
  }

  const componentLines = splitAsianPoint(leg.point)
  if (componentLines.length === 0) return unknownSettlement()
  const componentStatuses = componentLines.map((point) =>
    settlePointComponent({ ...leg, point }, score),
  )
  if (componentStatuses.some((status) => status === "unknown")) return unknownSettlement()

  if (componentStatuses.length === 1) {
    return wagerResult(componentStatuses[0] ?? "unknown", leg.decimal)
  }

  const status = classifySplitStatuses(componentStatuses)
  const componentWeight = 1 / componentStatuses.length
  const grossReturn = componentStatuses.reduce(
    (sum, componentStatus) => sum + componentWeight * grossMultiple(componentStatus, leg.decimal),
    0,
  )
  const realizedReturn = grossReturn - 1

  return {
    status,
    realizedReturn,
    won: status === "win" || status === "half_win"
      ? true
      : status === "loss" || status === "half_loss"
        ? false
        : null,
    componentStatuses,
  }
}

/**
 * Split an Asian quarter point into its two adjacent half-point components.
 * Whole and half lines return a single component. Unsupported eighth lines
 * return an empty array so they cannot be settled incorrectly.
 */
export function splitAsianPoint(point: number): number[] {
  if (!Number.isFinite(point)) return []
  const doubled = point * 2
  const nearestHalf = Math.round(doubled)
  if (Math.abs(doubled - nearestHalf) <= EPSILON) return [cleanZero(nearestHalf / 2)]

  const quadrupled = point * 4
  if (Math.abs(quadrupled - Math.round(quadrupled)) > EPSILON) return []
  const lower = Math.floor(doubled) / 2
  const upper = Math.ceil(doubled) / 2
  if (almostEqual(lower, upper)) return [cleanZero(lower)]
  return [cleanZero(lower), cleanZero(upper)]
}

/** True only for .25/.75-style Asian quarter lines. */
export function isAsianQuarterLine(point: number): boolean {
  return splitAsianPoint(point).length === 2
}

/**
 * Settle a complete middle position, including pushes, half wins/losses, and
 * exact stake-weighted realized return. Fractions are normalized defensively.
 */
export function settleMiddlePosition(
  input: MiddlePositionSettlementInput,
): MiddlePositionSettlement {
  const [legA, legB] = input.legs
  if (legA.market !== input.market || legB.market !== input.market || !validScore(input.score)) {
    return unknownMiddle()
  }

  const settlementA = settlePointLeg(legA, input.score)
  const settlementB = settlePointLeg(legB, input.score)
  const statuses = [settlementA.status, settlementB.status] as const
  const finalReferenceValue = referenceValue(input.market, input.referenceOutcome, input.score)

  if (statuses.includes("unknown") || settlementA.realizedReturn === null || settlementB.realizedReturn === null) {
    return {
      status: "unknown",
      legStatuses: statuses,
      finalReferenceValue,
      wonBoth: null,
      realizedReturn: null,
    }
  }

  const stakeTotal = legA.stakeFraction + legB.stakeFraction
  if (!Number.isFinite(stakeTotal) || stakeTotal <= EPSILON) {
    return {
      status: "unknown",
      legStatuses: statuses,
      finalReferenceValue,
      wonBoth: null,
      realizedReturn: null,
    }
  }

  const fractionA = legA.stakeFraction / stakeTotal
  const fractionB = legB.stakeFraction / stakeTotal
  const grossA = fractionA * (1 + settlementA.realizedReturn)
  const grossB = fractionB * (1 + settlementB.realizedReturn)

  return {
    status: classifyMiddle(statuses),
    legStatuses: statuses,
    finalReferenceValue,
    wonBoth: statuses[0] === "win" && statuses[1] === "win",
    realizedReturn: grossA + grossB - 1,
  }
}

/** Parse a provider score into a finite non-negative number. */
export function parseScore(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

function settlePointComponent(
  leg: PointLegSettlementInput,
  score: FinalScore,
): "win" | "loss" | "push" | "unknown" {
  if (leg.market === "totals") {
    const total = score.homeScore + score.awayScore
    const outcome = normalizeLabel(leg.outcome)
    if (outcome === "over") return compare(total, leg.point)
    if (outcome === "under") return invertComparison(compare(total, leg.point))
    return "unknown"
  }

  const selected = normalizeLabel(leg.outcome)
  const home = normalizeLabel(score.homeTeam)
  const away = normalizeLabel(score.awayTeam)
  let selectedScore: number
  let opponentScore: number

  if (selected === home) {
    selectedScore = score.homeScore
    opponentScore = score.awayScore
  } else if (selected === away) {
    selectedScore = score.awayScore
    opponentScore = score.homeScore
  } else {
    return "unknown"
  }

  return compare(selectedScore + leg.point, opponentScore)
}

function compare(left: number, right: number): "win" | "loss" | "push" {
  if (almostEqual(left, right)) return "push"
  return left > right ? "win" : "loss"
}

function invertComparison(status: "win" | "loss" | "push"): "win" | "loss" | "push" {
  if (status === "win") return "loss"
  if (status === "loss") return "win"
  return status
}

function classifySplitStatuses(statuses: readonly WagerSettlementStatus[]): WagerSettlementStatus {
  const wins = statuses.filter((status) => status === "win").length
  const pushes = statuses.filter((status) => status === "push").length
  const losses = statuses.filter((status) => status === "loss").length
  if (wins === statuses.length) return "win"
  if (losses === statuses.length) return "loss"
  if (pushes === statuses.length) return "push"
  if (wins > 0 && pushes > 0 && losses === 0) return "half_win"
  if (losses > 0 && pushes > 0 && wins === 0) return "half_loss"
  // This cannot occur for adjacent quarter-line components and integer scores.
  return "unknown"
}

function classifyMiddle(
  statuses: readonly [WagerSettlementStatus, WagerSettlementStatus],
): MiddlePositionSettlement["status"] {
  if (statuses[0] === "unknown" || statuses[1] === "unknown") return "unknown"
  if (statuses[0] === "win" && statuses[1] === "win") return "both_win"
  if (statuses[0] === "win" && statuses[1] === "loss") return "leg_a_win"
  if (statuses[0] === "loss" && statuses[1] === "win") return "leg_b_win"
  if (statuses[0] === "loss" && statuses[1] === "loss") return "both_loss"
  if (statuses[0] === "push" || statuses[1] === "push") return "push_mix"
  return "partial_mix"
}

function referenceValue(
  market: "spreads" | "totals",
  referenceOutcome: string | null | undefined,
  score: FinalScore,
): number | null {
  if (market === "totals") return score.homeScore + score.awayScore
  if (!referenceOutcome) return null
  const reference = normalizeLabel(referenceOutcome)
  if (reference === normalizeLabel(score.homeTeam)) return score.homeScore - score.awayScore
  if (reference === normalizeLabel(score.awayTeam)) return score.awayScore - score.homeScore
  return null
}

function grossMultiple(status: WagerSettlementStatus, decimal: number): number {
  if (status === "win") return decimal
  if (status === "half_win") return (decimal + 1) / 2
  if (status === "push") return 1
  if (status === "half_loss") return 0.5
  if (status === "loss") return 0
  return Number.NaN
}

function wagerResult(status: WagerSettlementStatus, decimal: number): WagerSettlement {
  if (status === "unknown") return unknownSettlement()
  if (status === "push") return { status, realizedReturn: 0, won: null }
  if (status === "win") return { status, realizedReturn: decimal - 1, won: true }
  if (status === "half_win") return { status, realizedReturn: (decimal - 1) / 2, won: true }
  if (status === "half_loss") return { status, realizedReturn: -0.5, won: false }
  return { status, realizedReturn: -1, won: false }
}

function unknownSettlement(): WagerSettlement {
  return { status: "unknown", realizedReturn: null, won: null }
}

function unknownMiddle(): MiddlePositionSettlement {
  return {
    status: "unknown",
    legStatuses: ["unknown", "unknown"],
    finalReferenceValue: null,
    wonBoth: null,
    realizedReturn: null,
  }
}

function validScore(score: FinalScore): boolean {
  return (
    normalizeLabel(score.homeTeam).length > 0 &&
    normalizeLabel(score.awayTeam).length > 0 &&
    Number.isFinite(score.homeScore) &&
    Number.isFinite(score.awayScore) &&
    score.homeScore >= 0 &&
    score.awayScore >= 0
  )
}

function isValidDecimal(decimal: number): boolean {
  return Number.isFinite(decimal) && decimal > 1
}

function normalizeLabel(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ")
}

function isDrawLabel(value: string): boolean {
  return value === "draw" || value === "tie" || value === "the draw"
}

function cleanZero(value: number): number {
  return Object.is(value, -0) ? 0 : value
}

function almostEqual(left: number, right: number): boolean {
  return Math.abs(left - right) <= EPSILON
}
