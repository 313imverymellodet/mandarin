const EPSILON = 1e-12

/** Opportunity types that can consume shared bankroll exposure. */
export type PortfolioPositionKind = "arbitrage" | "positive_ev" | "middle"

/** One sportsbook's fraction of an atomic multi-leg position. Fractions sum to one. */
export interface PortfolioBookExposure {
  bookmaker: string
  fraction: number
}

/**
 * One already-validated position proposed by an opportunity engine.
 * `requestedStakeFraction` is a fraction of total bankroll, not currency.
 */
export interface PortfolioCandidate {
  id: string
  eventId: string
  league: string
  marketKey: string
  kind: PortfolioPositionKind
  /** Total bankroll fraction requested by the source engine. */
  requestedStakeFraction: number
  /** Buffered expected return per unit stake; 0.02 means +2%. */
  expectedReturn: number
  /** Expected log-growth from the source engine when available. */
  expectedLogGrowth?: number
  /** 0..100 signal-quality score. */
  confidence: number
  /** False means the source engine rejected this position. */
  isActionable: boolean
  /** Optional outcome identifier used to collapse duplicate same-side signals. */
  outcomeKey?: string
  /**
   * Explicit dependency key. Positions sharing this key are mutually exclusive
   * by default. Example: `event:h2h:lakers`.
   */
  correlationKey?: string
  /** Additional exposure buckets such as team, athlete, game total, or parlay leg. */
  correlationTags?: readonly string[]
  /** Atomic position exposure by book; required for multi-leg arbs/middles. */
  bookmakerExposures: readonly PortfolioBookExposure[]
}

/** Bankroll and concentration limits. All stake limits are bankroll fractions. */
export interface PortfolioOptions {
  maxTotalStakeFraction?: number
  maxPerPositionStakeFraction?: number
  maxPerEventStakeFraction?: number
  maxPerBookStakeFraction?: number
  maxPerLeagueStakeFraction?: number
  maxPerCorrelationTagStakeFraction?: number
  minimumAllocationFraction?: number
  /** Reject source positions below this buffered expected-return threshold. */
  minimumExpectedReturn?: number
  maxPositionsPerEvent?: number
  /** Keep only the strongest candidate for a shared correlation key. Defaults true. */
  deduplicateCorrelationKeys?: boolean
  /** Optional per-kind hard caps, applied before all portfolio caps. */
  maxStakeFractionByKind?: Partial<Record<PortfolioPositionKind, number>>
}

/** Why a candidate received no portfolio allocation. */
export type PortfolioRejectionReason =
  | "not_actionable"
  | "invalid_candidate"
  | "expected_return_below_threshold"
  | "duplicate_correlation_key"
  | "event_position_limit"
  | "below_minimum_allocation"
  | "portfolio_capacity_exhausted"

/** One accepted atomic allocation. */
export interface PortfolioAllocation {
  candidate: PortfolioCandidate
  /** Total bankroll fraction assigned to the complete position. */
  allocatedStakeFraction: number
  /** Per-book bankroll fractions after scaling the atomic position. */
  bookmakerStakeFractions: { bookmaker: string; stakeFraction: number }[]
  expectedProfitFraction: number
  /** Ranking metric used by the deterministic greedy allocator. */
  priorityScore: number
  /** True when one or more limits clipped the source recommendation. */
  wasClipped: boolean
}

/** One candidate that the portfolio layer did not allocate. */
export interface PortfolioRejection {
  candidate: PortfolioCandidate
  reason: PortfolioRejectionReason
}

/** Complete allocation result and concentration diagnostics. */
export interface PortfolioPlan {
  allocations: PortfolioAllocation[]
  rejections: PortfolioRejection[]
  totalStakeFraction: number
  expectedProfitFraction: number
  bookExposureFractions: Record<string, number>
  eventExposureFractions: Record<string, number>
  leagueExposureFractions: Record<string, number>
  correlationTagExposureFractions: Record<string, number>
}

interface NormalizedCandidate {
  original: PortfolioCandidate
  id: string
  eventId: string
  league: string
  marketKey: string
  outcomeKey: string
  correlationKey: string
  correlationTags: string[]
  bookmakerExposures: { bookmaker: string; fraction: number }[]
  requestedStakeFraction: number
  expectedReturn: number
  expectedLogGrowth: number
  confidence: number
  priorityScore: number
}

export interface DefaultPortfolioOptions
  extends Omit<Required<PortfolioOptions>, "maxStakeFractionByKind"> {
  maxStakeFractionByKind: Record<PortfolioPositionKind, number>
}

interface ResolvedPortfolioOptions {
  maxTotalStakeFraction: number
  maxPerPositionStakeFraction: number
  maxPerEventStakeFraction: number
  maxPerBookStakeFraction: number
  maxPerLeagueStakeFraction: number
  maxPerCorrelationTagStakeFraction: number
  minimumAllocationFraction: number
  minimumExpectedReturn: number
  maxPositionsPerEvent: number
  deduplicateCorrelationKeys: boolean
  maxStakeFractionByKind: Record<PortfolioPositionKind, number>
}

/**
 * Allocates already-vetted opportunities under bankroll, event, sportsbook,
 * league, and dependency caps. Multi-leg positions remain atomic: all legs are
 * scaled together or the position is rejected. The function is deterministic,
 * side-effect-free, and never increases a source engine's requested stake.
 */
export function allocatePortfolio(
  candidates: readonly PortfolioCandidate[],
  options: PortfolioOptions = {},
): PortfolioPlan {
  const resolved = resolveOptions(options)
  const normalized: NormalizedCandidate[] = []
  const rejections: PortfolioRejection[] = []

  for (const candidate of candidates) {
    if (!candidate.isActionable) {
      rejections.push({ candidate, reason: "not_actionable" })
      continue
    }
    const prepared = normalizeCandidate(candidate)
    if (prepared === null) {
      rejections.push({ candidate, reason: "invalid_candidate" })
      continue
    }
    if (prepared.expectedReturn <= resolved.minimumExpectedReturn + EPSILON) {
      rejections.push({ candidate, reason: "expected_return_below_threshold" })
      continue
    }
    normalized.push(prepared)
  }

  normalized.sort(compareCandidates)

  const seenCorrelationKeys = new Set<string>()
  const totalExposure = { value: 0 }
  const bookExposure = new Map<string, number>()
  const eventExposure = new Map<string, number>()
  const leagueExposure = new Map<string, number>()
  const tagExposure = new Map<string, number>()
  const eventPositionCount = new Map<string, number>()
  const allocations: PortfolioAllocation[] = []

  for (const candidate of normalized) {
    if (
      resolved.deduplicateCorrelationKeys &&
      seenCorrelationKeys.has(candidate.correlationKey)
    ) {
      rejections.push({ candidate: candidate.original, reason: "duplicate_correlation_key" })
      continue
    }

    if (
      (eventPositionCount.get(candidate.eventId) ?? 0) >=
      resolved.maxPositionsPerEvent
    ) {
      rejections.push({ candidate: candidate.original, reason: "event_position_limit" })
      continue
    }

    const kindCap = resolved.maxStakeFractionByKind[candidate.original.kind]
    let maximum = Math.min(
      candidate.requestedStakeFraction,
      resolved.maxPerPositionStakeFraction,
      kindCap,
      resolved.maxTotalStakeFraction - totalExposure.value,
      resolved.maxPerEventStakeFraction - (eventExposure.get(candidate.eventId) ?? 0),
      resolved.maxPerLeagueStakeFraction - (leagueExposure.get(candidate.league) ?? 0),
    )

    for (const tag of candidate.correlationTags) {
      maximum = Math.min(
        maximum,
        resolved.maxPerCorrelationTagStakeFraction - (tagExposure.get(tag) ?? 0),
      )
    }

    // If a book receives x% of the atomic position, position stake cannot exceed
    // remainingBookCapacity / x. This keeps every leg inside the same book cap.
    for (const exposure of candidate.bookmakerExposures) {
      const remaining =
        resolved.maxPerBookStakeFraction - (bookExposure.get(exposure.bookmaker) ?? 0)
      maximum = Math.min(maximum, remaining / exposure.fraction)
    }

    maximum = Math.max(0, maximum)
    if (maximum + EPSILON < resolved.minimumAllocationFraction) {
      rejections.push({
        candidate: candidate.original,
        reason:
          totalExposure.value + EPSILON >= resolved.maxTotalStakeFraction
            ? "portfolio_capacity_exhausted"
            : "below_minimum_allocation",
      })
      continue
    }

    const bookmakerStakeFractions = candidate.bookmakerExposures.map((exposure) => ({
      bookmaker: exposure.bookmaker,
      stakeFraction: maximum * exposure.fraction,
    }))

    const allocation: PortfolioAllocation = {
      candidate: candidate.original,
      allocatedStakeFraction: maximum,
      bookmakerStakeFractions,
      expectedProfitFraction: maximum * candidate.expectedReturn,
      priorityScore: candidate.priorityScore,
      wasClipped: maximum + EPSILON < candidate.requestedStakeFraction,
    }
    allocations.push(allocation)

    totalExposure.value += maximum
    increment(eventExposure, candidate.eventId, maximum)
    increment(leagueExposure, candidate.league, maximum)
    increment(eventPositionCount, candidate.eventId, 1)
    for (const tag of candidate.correlationTags) increment(tagExposure, tag, maximum)
    for (const exposure of bookmakerStakeFractions) {
      increment(bookExposure, exposure.bookmaker, exposure.stakeFraction)
    }
    seenCorrelationKeys.add(candidate.correlationKey)
  }

  // Rejections follow deterministic source priority instead of input order.
  rejections.sort((left, right) => compareText(left.candidate.id, right.candidate.id))

  return {
    allocations,
    rejections,
    totalStakeFraction: totalExposure.value,
    expectedProfitFraction: allocations.reduce(
      (total, allocation) => total + allocation.expectedProfitFraction,
      0,
    ),
    bookExposureFractions: mapToRecord(bookExposure),
    eventExposureFractions: mapToRecord(eventExposure),
    leagueExposureFractions: mapToRecord(leagueExposure),
    correlationTagExposureFractions: mapToRecord(tagExposure),
  }
}

/** Returns a conservative set of portfolio caps suitable for an initial rollout. */
export function getDefaultPortfolioOptions(): DefaultPortfolioOptions {
  return {
    maxTotalStakeFraction: 0.05,
    maxPerPositionStakeFraction: 0.01,
    maxPerEventStakeFraction: 0.015,
    maxPerBookStakeFraction: 0.025,
    maxPerLeagueStakeFraction: 0.03,
    maxPerCorrelationTagStakeFraction: 0.015,
    minimumAllocationFraction: 0.0005,
    minimumExpectedReturn: 0,
    maxPositionsPerEvent: 1,
    deduplicateCorrelationKeys: true,
    maxStakeFractionByKind: {
      arbitrage: 0.01,
      positive_ev: 0.01,
      middle: 0.005,
    },
  }
}

function normalizeCandidate(candidate: PortfolioCandidate): NormalizedCandidate | null {
  const id = normalizeKey(candidate.id)
  const eventId = normalizeKey(candidate.eventId)
  const league = normalizeKey(candidate.league)
  const marketKey = normalizeKey(candidate.marketKey)
  const outcomeKey = normalizeKey(candidate.outcomeKey ?? "")
  if (!id || !eventId || !league || !marketKey) return null
  if (!Number.isFinite(candidate.requestedStakeFraction) || candidate.requestedStakeFraction <= 0) {
    return null
  }
  if (!Number.isFinite(candidate.expectedReturn)) return null
  if (!Number.isFinite(candidate.confidence) || candidate.confidence < 0 || candidate.confidence > 100) {
    return null
  }

  const exposures = normalizeBookExposures(candidate.bookmakerExposures)
  if (exposures === null) return null

  const explicitCorrelationKey = normalizeKey(candidate.correlationKey ?? "")
  const correlationKey = explicitCorrelationKey ||
    [eventId, marketKey, outcomeKey || id].join(":")
  const correlationTags = [...new Set((candidate.correlationTags ?? [])
    .map(normalizeKey)
    .filter(Boolean))].sort(compareText)

  const expectedLogGrowth =
    candidate.expectedLogGrowth !== undefined && Number.isFinite(candidate.expectedLogGrowth)
      ? candidate.expectedLogGrowth
      : 0
  // Prefer risk-adjusted log growth when supplied. Otherwise use buffered EV,
  // gently scaled by signal quality. Negative-return candidates sort last but
  // remain eligible only when their source engine intentionally marked them so.
  const priorityScore = expectedLogGrowth > 0
    ? expectedLogGrowth
    : candidate.expectedReturn * (0.5 + 0.5 * candidate.confidence / 100)

  return {
    original: candidate,
    id,
    eventId,
    league,
    marketKey,
    outcomeKey,
    correlationKey,
    correlationTags,
    bookmakerExposures: exposures,
    requestedStakeFraction: candidate.requestedStakeFraction,
    expectedReturn: candidate.expectedReturn,
    expectedLogGrowth,
    confidence: candidate.confidence,
    priorityScore,
  }
}

function normalizeBookExposures(
  exposures: readonly PortfolioBookExposure[],
): { bookmaker: string; fraction: number }[] | null {
  if (exposures.length === 0) return null
  const grouped = new Map<string, number>()
  for (const exposure of exposures) {
    const bookmaker = normalizeKey(exposure.bookmaker)
    if (!bookmaker || !Number.isFinite(exposure.fraction) || exposure.fraction <= 0) {
      return null
    }
    grouped.set(bookmaker, (grouped.get(bookmaker) ?? 0) + exposure.fraction)
  }
  const total = [...grouped.values()].reduce((sum, value) => sum + value, 0)
  if (!Number.isFinite(total) || total <= EPSILON) return null
  return [...grouped.entries()]
    .map(([bookmaker, fraction]) => ({ bookmaker, fraction: fraction / total }))
    .sort((left, right) => compareText(left.bookmaker, right.bookmaker))
}

function resolveOptions(options: PortfolioOptions): ResolvedPortfolioOptions {
  const defaults = getDefaultPortfolioOptions()
  const kindCaps: Record<PortfolioPositionKind, number> = {
    ...defaults.maxStakeFractionByKind,
  }
  if (options.maxStakeFractionByKind) {
    for (const kind of ["arbitrage", "positive_ev", "middle"] as const) {
      const value = options.maxStakeFractionByKind[kind]
      if (value !== undefined) kindCaps[kind] = nonNegativeFinite(value, kindCaps[kind])
    }
  }

  return {
    maxTotalStakeFraction: nonNegativeFinite(
      options.maxTotalStakeFraction,
      defaults.maxTotalStakeFraction,
    ),
    maxPerPositionStakeFraction: nonNegativeFinite(
      options.maxPerPositionStakeFraction,
      defaults.maxPerPositionStakeFraction,
    ),
    maxPerEventStakeFraction: nonNegativeFinite(
      options.maxPerEventStakeFraction,
      defaults.maxPerEventStakeFraction,
    ),
    maxPerBookStakeFraction: nonNegativeFinite(
      options.maxPerBookStakeFraction,
      defaults.maxPerBookStakeFraction,
    ),
    maxPerLeagueStakeFraction: nonNegativeFinite(
      options.maxPerLeagueStakeFraction,
      defaults.maxPerLeagueStakeFraction,
    ),
    maxPerCorrelationTagStakeFraction: nonNegativeFinite(
      options.maxPerCorrelationTagStakeFraction,
      defaults.maxPerCorrelationTagStakeFraction,
    ),
    minimumAllocationFraction: nonNegativeFinite(
      options.minimumAllocationFraction,
      defaults.minimumAllocationFraction,
    ),
    minimumExpectedReturn: nonNegativeFinite(
      options.minimumExpectedReturn,
      defaults.minimumExpectedReturn,
    ),
    maxPositionsPerEvent: boundedInteger(
      options.maxPositionsPerEvent,
      defaults.maxPositionsPerEvent,
      1,
      100,
    ),
    deduplicateCorrelationKeys:
      options.deduplicateCorrelationKeys ?? defaults.deduplicateCorrelationKeys,
    maxStakeFractionByKind: kindCaps,
  }
}

function compareCandidates(left: NormalizedCandidate, right: NormalizedCandidate): number {
  const priority = right.priorityScore - left.priorityScore
  if (Math.abs(priority) > EPSILON) return priority
  const expectedReturn = right.expectedReturn - left.expectedReturn
  if (Math.abs(expectedReturn) > EPSILON) return expectedReturn
  const confidence = right.confidence - left.confidence
  if (Math.abs(confidence) > EPSILON) return confidence
  return compareText(left.id, right.id)
}

function increment(map: Map<string, number>, key: string, amount: number): void {
  map.set(key, (map.get(key) ?? 0) + amount)
}

function mapToRecord(map: Map<string, number>): Record<string, number> {
  return Object.fromEntries([...map.entries()].sort(([left], [right]) => compareText(left, right)))
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase()
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function nonNegativeFinite(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) && value >= 0 ? value : fallback
}

function boundedInteger(
  value: number | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  if (value === undefined || !Number.isFinite(value)) return fallback
  return Math.min(maximum, Math.max(minimum, Math.trunc(value)))
}
