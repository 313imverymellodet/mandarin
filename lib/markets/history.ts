import { getPool, insertRows } from "@/lib/db"
import type { OpportunityDTO } from "./types"

/**
 * Odds history: a lightweight time series of each market's edge, stored in
 * Postgres. Enables line-movement columns and sparklines. All writes are
 * best-effort and never block or fail the opportunities response; if the
 * database isn't configured, movement simply doesn't appear.
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
  const pool = getPool()
  if (!pool || ids.length === 0) return out

  const sinceIso = new Date(Date.now() - SIX_HOURS_MS).toISOString()
  const { rows } = await pool.query<{ opportunity_id: string; edge: number; captured_at: Date }>(
    `select opportunity_id, edge, captured_at from odds_snapshots
      where opportunity_id = any($1::text[]) and captured_at >= $2
      order by captured_at asc`,
    [ids, sinceIso],
  )

  const series = new Map<string, { t: number; edge: number }[]>()
  for (const row of rows) {
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
  const pool = getPool()
  if (!pool || opps.length === 0) return

  const capturedAt = new Date().toISOString()
  const rows = opps.map((o) => ({
    opportunity_id: o.id,
    league: o.league,
    matchup: o.matchup,
    edge: o.arbitrage,
    captured_at: capturedAt,
  }))

  void insertRows("odds_snapshots", ["opportunity_id", "league", "matchup", "edge", "captured_at"], rows).catch((error) =>
    console.error("odds_snapshots insert failed:", error instanceof Error ? error.message : error),
  )

  // Occasionally prune history older than 48h so the table stays small.
  if (Math.random() < 0.1) {
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
    void pool.query("delete from odds_snapshots where captured_at < $1", [cutoff]).catch(() => undefined)
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
