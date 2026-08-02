import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { summarizeEdgeBacktest, buildCalibrationBins, type SettledEdgeRecord } from "@/lib/markets/edge-history"

/** Latest closing fair probability per (event, outcome) before commence time. */
async function loadClosingProbs(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  eventIds: string[],
): Promise<Map<string, number>> {
  const closing = new Map<string, number>()
  if (eventIds.length === 0) return closing
  const { data } = await admin
    .from("market_fair_probs")
    .select("event_id, outcome, observed_at, commence_time, fair_probability")
    .in("event_id", eventIds)
    .order("observed_at", { ascending: true })
  for (const row of data ?? []) {
    // Only pregame snapshots count toward the closing line.
    if (row.commence_time && new Date(row.observed_at as string) >= new Date(row.commence_time as string)) continue
    closing.set(`${row.event_id}::${(row.outcome as string).toLowerCase()}`, row.fair_probability as number)
  }
  return closing
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

  const admin = createAdminClient()
  if (!admin) {
    return NextResponse.json({ error: "Telemetry store is not configured." }, { status: 503 })
  }

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [signals, rejections, fairProbs] = await Promise.all([
    admin
      .from("edge_signals")
      .select(
        "event_id, league, matchup, bookmaker, outcome, decimal_odds, fair_probability, net_ev, confidence, anchor_mode, observed_at, won, settled_at",
      )
      .gte("observed_at", since)
      .order("observed_at", { ascending: false })
      .limit(1000),
    admin.from("edge_rejections").select("reason, count").gte("observed_at", since).limit(2000),
    admin.from("market_fair_probs").select("event_id", { count: "exact", head: true }).gte("observed_at", since),
  ])

  if (signals.error) {
    return NextResponse.json(
      { error: `Telemetry unavailable: ${signals.error.message}. Have you run supabase/schema.sql?` },
      { status: 503 },
    )
  }

  const rows = signals.data ?? []
  const settled = rows.filter((r) => r.won !== null)

  // Aggregate rejection reasons — the most useful R&D signal right now.
  const reasonTotals = new Map<string, number>()
  for (const r of rejections.data ?? []) {
    reasonTotals.set(r.reason as string, (reasonTotals.get(r.reason as string) ?? 0) + (r.count as number))
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
    const key = `${r.event_id}::${(r.bookmaker as string).toLowerCase()}::${(r.outcome as string).toLowerCase()}`
    positions.set(key, r) // last write wins → oldest row (earliest entry)
  }
  const closing = await loadClosingProbs(admin, [...new Set([...positions.values()].map((r) => r.event_id as string))])
  const settledRecords: SettledEdgeRecord[] = [...positions.values()].map((r) => {
    const clv = closing.get(`${r.event_id}::${(r.outcome as string).toLowerCase()}`)
    return {
      fairProbability: r.fair_probability as number,
      decimalTaken: r.decimal_odds as number,
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
      fairProbabilitySamples: fairProbs.count ?? 0,
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
