import { config } from "@/lib/config"
import { getPool } from "@/lib/db"
import { settleH2HWager, parseScore, type FinalScore } from "./settlement-math"

/**
 * Scheduled settlement. Joins real game results to the +EV signals we stored in
 * shadow telemetry so the engine can eventually be scored on realized outcomes
 * (with CLV, Brier, calibration). Best-effort and idempotent — only settles
 * rows whose `won` is still null, so a cron retry never double-settles.
 *
 * The Odds API /scores endpoint costs 1 credit (2 with daysFrom). We only poll
 * sports that actually have unsettled signals, and log the quota headers.
 */

interface OddsScoreEntry {
  id: string
  sport_key: string
  completed: boolean
  home_team: string
  away_team: string
  scores: { name: string; score: string }[] | null
}

export interface SettlementResult {
  ok: boolean
  sportsPolled: number
  eventsCompleted: number
  signalsSettled: number
  requestsRemaining?: number
  message?: string
}

/** Strip the pipeline id prefix to recover the provider's raw event id. */
function providerEventId(signalEventId: string): string {
  return signalEventId.replace(/^oddsapi-/, "")
}

function toFinalScore(entry: OddsScoreEntry): FinalScore | null {
  if (!entry.scores) return null
  const byTeam = new Map<string, number>()
  for (const s of entry.scores) {
    const n = parseScore(s.score)
    if (n !== null) byTeam.set(s.name.trim().toLowerCase(), n)
  }
  const home = byTeam.get(entry.home_team.trim().toLowerCase())
  const away = byTeam.get(entry.away_team.trim().toLowerCase())
  if (home === undefined || away === undefined) return null
  return { homeTeam: entry.home_team, awayTeam: entry.away_team, homeScore: home, awayScore: away }
}

export async function runSettlement(): Promise<SettlementResult> {
  if (!config.oddsApi.settlement.enabled) {
    return { ok: false, sportsPolled: 0, eventsCompleted: 0, signalsSettled: 0, message: "SETTLEMENT_ENABLED is off" }
  }
  const pool = getPool()
  if (!pool || !config.oddsApi.enabled) {
    return { ok: false, sportsPolled: 0, eventsCompleted: 0, signalsSettled: 0, message: "Database or Odds API not configured" }
  }

  // Which sports still have unsettled signals for games that have started?
  let pending: { id: string; event_id: string; outcome: string; decimal_odds: number; league: string | null }[]
  try {
    const result = await pool.query<{ id: string; event_id: string; outcome: string; decimal_odds: number; league: string | null }>(
      `select id, event_id, outcome, decimal_odds, league from edge_signals
        where won is null and commence_time < now()
        limit 2000`,
    )
    pending = result.rows
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { ok: false, sportsPolled: 0, eventsCompleted: 0, signalsSettled: 0, message }
  }
  if (pending.length === 0) return { ok: true, sportsPolled: 0, eventsCompleted: 0, signalsSettled: 0, message: "nothing to settle" }

  // We stored league labels (MLB/MLS/UFC…), not sport keys, so poll the
  // configured sport list — these are the only sports we ever signal on.
  const sports = config.oddsApi.sports
  const scoreByEventId = new Map<string, OddsScoreEntry>()
  let requestsRemaining: number | undefined
  let completed = 0

  for (const sportKey of sports) {
    const url = new URL(`${config.oddsApi.baseUrl}/sports/${sportKey}/scores`)
    url.searchParams.set("apiKey", config.oddsApi.key!)
    url.searchParams.set("daysFrom", "3")
    try {
      const res = await fetch(url, { cache: "no-store" })
      const remainingHeader = res.headers.get("x-requests-remaining")
      if (remainingHeader !== null && Number.isFinite(Number(remainingHeader))) {
        requestsRemaining = Number(remainingHeader)
      }
      console.log(
        `settlement scores ${sportKey}: status=${res.status} used=${res.headers.get("x-requests-used")} remaining=${res.headers.get("x-requests-remaining")} last=${res.headers.get("x-requests-last")}`,
      )
      if (!res.ok) continue
      const entries = (await res.json()) as OddsScoreEntry[]
      if (!Array.isArray(entries)) continue
      for (const e of entries) {
        if (e.completed) {
          scoreByEventId.set(e.id, e)
          completed++
        }
      }
    } catch (err) {
      console.error(`settlement scores ${sportKey} failed:`, err instanceof Error ? err.message : err)
    }
  }

  // Settle each pending signal whose event completed.
  let settled = 0
  const settledAt = new Date().toISOString()
  for (const sig of pending) {
    const entry = scoreByEventId.get(providerEventId(sig.event_id))
    if (!entry) continue
    const score = toFinalScore(entry)
    if (!score) continue

    const result = settleH2HWager({
      outcome: sig.outcome,
      decimal: sig.decimal_odds,
      score,
    })
    // Only write a definitive win/loss; leave push/unknown for manual review.
    if (result.won === null) continue

    try {
      // `won is null` is the idempotency guard against concurrent/retry runs.
      const update = await pool.query(
        "update edge_signals set won = $1, settled_at = $2 where id = $3 and won is null",
        [result.won, settledAt, sig.id],
      )
      settled += update.rowCount ?? 0
    } catch (error) {
      console.error(`settlement update ${sig.id} failed:`, error instanceof Error ? error.message : error)
    }
  }

  return {
    ok: true,
    sportsPolled: sports.length,
    eventsCompleted: completed,
    signalsSettled: settled,
    ...(requestsRemaining !== undefined ? { requestsRemaining } : {}),
  }
}
