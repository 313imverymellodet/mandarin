import { createAdminClient } from "@/lib/supabase/admin"
import type { OpportunityDTO } from "./types"

/**
 * Odds history: a lightweight time series of each market's edge, stored in
 * Supabase. Enables line-movement columns and sparklines. All writes are
 * best-effort and never block or fail the opportunities response; if Supabase
 * isn't configured, movement simply doesn't appear.
 */

export interface Movement {
  /** Change in edge (percentage points) over ~1h; undefined if too little history. */
  delta1h?: number
  delta6h?: number
  /** Downsampled edge series (oldest→newest) for a sparkline. */
  spark: number[]
}

const SIX_HOURS_MS = 6 * 60 * 60 * 1000
const ONE_HOUR_MS = 60 * 60 * 1000

/** Fetch recent edge history for the given markets and derive movement. */
export async function getEdgeMovement(ids: string[]): Promise<Map<string, Movement>> {
  const out = new Map<string, Movement>()
  const admin = createAdminClient()
  if (!admin || ids.length === 0) return out

  const sinceIso = new Date(Date.now() - SIX_HOURS_MS).toISOString()
  const { data, error } = await admin
    .from("odds_snapshots")
    .select("opportunity_id, edge, captured_at")
    .in("opportunity_id", ids)
    .gte("captured_at", sinceIso)
    .order("captured_at", { ascending: true })

  if (error || !data) return out

  const series = new Map<string, { t: number; edge: number }[]>()
  for (const row of data as { opportunity_id: string; edge: number; captured_at: string }[]) {
    const arr = series.get(row.opportunity_id) ?? []
    arr.push({ t: new Date(row.captured_at).getTime(), edge: row.edge })
    series.set(row.opportunity_id, arr)
  }

  const now = Date.now()
  for (const [id, points] of series) {
    if (points.length === 0) continue
    const latest = points[points.length - 1].edge
    out.set(id, {
      delta1h: deltaSince(points, latest, now - ONE_HOUR_MS),
      delta6h: deltaSince(points, latest, now - SIX_HOURS_MS),
      spark: downsample(points.map((p) => p.edge), 16),
    })
  }
  return out
}

/** Persist the current edge for each market. Fire-and-forget. */
export function recordSnapshots(opps: OpportunityDTO[]): void {
  const admin = createAdminClient()
  if (!admin || opps.length === 0) return

  const capturedAt = new Date().toISOString()
  const rows = opps.map((o) => ({
    opportunity_id: o.id,
    league: o.league,
    matchup: o.matchup,
    edge: o.arbitrage,
    captured_at: capturedAt,
  }))

  void admin
    .from("odds_snapshots")
    .insert(rows)
    .then(({ error }) => {
      if (error) console.error("odds_snapshots insert failed:", error.message)
    })

  // Occasionally prune history older than 48h so the table stays small.
  if (Math.random() < 0.1) {
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
    void admin.from("odds_snapshots").delete().lt("captured_at", cutoff).then(() => undefined)
  }
}

/** Latest edge minus the edge at (or just before) `targetTime`. */
function deltaSince(points: { t: number; edge: number }[], latest: number, targetTime: number): number | undefined {
  let past: number | undefined
  for (const p of points) {
    if (p.t <= targetTime) past = p.edge
    else break
  }
  if (past === undefined) return undefined
  return Math.round((latest - past) * 100) / 100
}

/** Reduce a series to at most `max` evenly-spaced points. */
function downsample(values: number[], max: number): number[] {
  if (values.length <= max) return values
  const step = (values.length - 1) / (max - 1)
  const out: number[] = []
  for (let i = 0; i < max; i++) out.push(values[Math.round(i * step)])
  return out
}
