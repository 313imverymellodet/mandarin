import { NextResponse } from "next/server"
import type { Pool } from "pg"
import { getCurrentUser } from "@/lib/session"
import { getPool } from "@/lib/db"
import { summarizeEdgeBacktest, buildCalibrationBins, type SettledEdgeRecord } from "@/lib/markets/edge-history"

/** Latest closing fair probability per (event, outcome) before commence time. */
async function loadClosingProbs(pool: Pool, eventIds: string[]): Promise<Map<string, number>> {
  const closing = new Map<string, number>()
  if (eventIds.length === 0) return closing
  // Only pregame snapshots count toward the closing line; ascending order so
  // the last write per (event, outcome) is the latest pregame value.
  const { rows } = await pool.query<{ event_id: string; outcome: string; fair_probability: number }>(
    `select event_id, outcome, fair_probability from market_fair_probs
      where event_id = any($1::text[])
        and (commence_time is null or observed_at < commence_time)
      order by observed_at asc`,
    [eventIds],
  )
  for (const row of rows) {
    closing.set(`${row.event_id}::${row.outcome.toLowerCase()}`, row.fair_probability)
  }
  return closing
}

interface SignalRow {
  event_id: string
  league: string | null
  matchup: string | null
  bookmaker: string
  outcome: string
  decimal_odds: number
  fair_probability: number
  net_ev: number | null
  confidence: number | null
  anchor_mode: string | null
  observed_at: Date
  won: boolean | null
  settled_at: Date | null
}

export const dynamic = "force-dynamic"

/**
 * Internal shadow-telemetry summary: what the V2 engine is collecting, and why
 * candidate edges are being rejected. Read-only, requires an authenticated
 * session. This reports collection coverage only — it makes no performance
 * claim, and CLV/calibration require settled results.
 */
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 })

  const pool = getPool()
  if (!pool) {
    return NextResponse.json({ error: "Telemetry store is not configured." }, { status: 503 })
  }

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  let rows: SignalRow[]
  let rejections: { reason: string; count: number }[]
  let fairProbCount: number
  try {
    const [signals, rejectionResult, fairProbs] = await Promise.all([
      pool.query<SignalRow>(
        `select event_id, league, matchup, bookmaker, outcome, decimal_odds, fair_probability, net_ev,
                confidence, anchor_mode, observed_at, won, settled_at
           from edge_signals where observed_at >= $1
          order by observed_at desc limit 1000`,
        [since],
      ),
      pool.query<{ reason: string; count: number }>(
        "select reason, count from edge_rejections where observed_at >= $1 limit 2000",
        [since],
      ),
      pool.query<{ n: string }>("select count(*) as n from market_fair_probs where observed_at >= $1", [since]),
    ])
    rows = signals.rows
    rejections = rejectionResult.rows
    fairProbCount = Number(fairProbs.rows[0]?.n ?? 0)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: `Telemetry unavailable: ${message}. Have you run npm run db:migrate?` },
      { status: 503 },
    )
  }

  const settled = rows.filter((r) => r.won !== null)

  // Aggregate rejection reasons — the most useful R&D signal right now.
  const reasonTotals = new Map<string, number>()
  for (const r of rejections) {
    reasonTotals.set(r.reason, (reasonTotals.get(r.reason) ?? 0) + r.count)
  }

  // Performance: only computed from settled signals, and reported only when
  // there are enough of them to mean anything. No claim without data.
  //
  // A persistent signal is stored once per poll, so `settled` holds many rows
  // for the same wager. Dedupe to ONE position per (event, book, outcome) —
  // otherwise CLV/Brier/ROI would over-count frequently-observed signals. Rows
  // arrive newest-first; we keep the earliest observation as the entry price.
  const positions = new Map<string, (typeof settled)[number]>()
  for (const r of settled) {
    if (typeof r.fair_probability !== "number" || typeof r.decimal_odds !== "number") continue
    const key = `${r.event_id}::${r.bookmaker.toLowerCase()}::${r.outcome.toLowerCase()}`
    positions.set(key, r) // last write wins → oldest row (earliest entry)
  }
  const closing = await loadClosingProbs(pool, [...new Set([...positions.values()].map((r) => r.event_id))]).catch(
    () => new Map<string, number>(),
  )
  const settledRecords: SettledEdgeRecord[] = [...positions.values()].map((r) => {
    const clv = closing.get(`${r.event_id}::${r.outcome.toLowerCase()}`)
    return {
      fairProbability: r.fair_probability,
      decimalTaken: r.decimal_odds,
      won: r.won as boolean,
      ...(clv !== undefined ? { closingFairProbability: clv } : {}),
    }
  })
  const MIN_FOR_STATS = 30
  const performance =
    settledRecords.length >= MIN_FOR_STATS
      ? { summary: summarizeEdgeBacktest(settledRecords), calibrationBins: buildCalibrationBins(settledRecords) }
      : null

  return NextResponse.json({
    windowDays: 30,
    performance,
    performanceNote:
      performance === null
        ? `Need ≥${MIN_FOR_STATS} settled signals before reporting CLV/Brier/calibration (have ${settledRecords.length}). Enable SETTLEMENT_ENABLED and let it accrue.`
        : "Held-out realized performance. Still a small sample — treat as directional, not proof.",
    collection: {
      actionableSignals: rows.length,
      settledSignals: settled.length,
      fairProbabilitySamples: fairProbCount,
      distinctEvents: new Set(rows.map((r) => r.event_id)).size,
    },
    rejectionReasons: [...reasonTotals.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([reason, count]) => ({ reason, count })),
    recentSignals: rows.slice(0, 25),
    note:
      "Collection coverage only. Closing-line value and calibration require settled results; no performance claim is implied.",
  })
}
