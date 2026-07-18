import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

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

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [signals, rejections, fairProbs] = await Promise.all([
    admin
      .from("edge_signals")
      .select("event_id, league, matchup, bookmaker, outcome, net_ev, confidence, anchor_mode, observed_at, won")
      .gte("observed_at", since)
      .order("observed_at", { ascending: false })
      .limit(200),
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

  return NextResponse.json({
    windowDays: 7,
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
