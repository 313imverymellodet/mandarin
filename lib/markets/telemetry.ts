import { createAdminClient } from "@/lib/supabase/admin"
import { config } from "@/lib/config"
import type { EdgeAnalysis } from "./edge"

/**
 * Edge Engine V2 shadow telemetry.
 *
 * The purpose is a feedback loop: score the model on closing-line value and
 * calibration instead of short-run ROI. Everything here is best-effort — a
 * telemetry failure must never affect the live odds response.
 *
 * Volume policy (deliberate): storing every evaluation would be ~500 rows per
 * poll. We store actionable signals in full, anchor fair probabilities on a
 * throttled cadence (enough to reconstruct the closing line), and rejection
 * reasons as aggregated counts.
 */

/** Anchor fair probabilities are sampled at most once per event per bucket. */
const FAIR_PROB_BUCKET_MS = 5 * 60_000
const RETENTION_DAYS = 21

export interface TelemetryEvent {
  eventId: string
  league: string
  matchup: string
  commenceTime: string
  analysis: EdgeAnalysis
}

/** Round a timestamp down to the sampling bucket so repeat polls collapse. */
function bucketIso(iso: string, bucketMs: number): string {
  const ms = new Date(iso).getTime()
  if (!Number.isFinite(ms)) return iso
  return new Date(Math.floor(ms / bucketMs) * bucketMs).toISOString()
}

/**
 * Persist one scan's V2 telemetry. Fire-and-forget: callers must not await
 * this in a way that can fail the request.
 */
export function recordEdgeTelemetry(sportKey: string, asOf: string, events: readonly TelemetryEvent[]): void {
  const admin = createAdminClient()
  if (!admin || events.length === 0) return

  const profile = config.oddsApi.v2.defaultProfile
  const signalRows: Record<string, unknown>[] = []
  const fairProbRows: Record<string, unknown>[] = []
  const rejectionCounts = new Map<string, number>()
  const fairProbBucket = bucketIso(asOf, FAIR_PROB_BUCKET_MS)

  for (const { eventId, league, matchup, commenceTime, analysis } of events) {
    // Actionable signals — the bets we would actually surface.
    for (const evaluation of analysis.evaluations) {
      if (!evaluation.isActionable) continue
      signalRows.push({
        event_id: eventId,
        league,
        matchup,
        commence_time: commenceTime,
        observed_at: asOf,
        profile,
        devig_method: "power",
        market: "h2h",
        bookmaker: evaluation.bookmaker,
        outcome: evaluation.outcome,
        decimal_odds: evaluation.decimal,
        fair_probability: evaluation.fairProbability,
        probability_sigma: evaluation.probabilitySigma,
        conservative_fair_probability: evaluation.conservativeFairProbability,
        raw_ev: evaluation.ev,
        conservative_ev: evaluation.conservativeEv,
        net_ev: evaluation.netEv,
        confidence: evaluation.confidence,
        anchor_source: evaluation.anchorSource,
        anchor_mode: evaluation.anchorMode,
        anchor_bookmakers: evaluation.anchorBookmakers,
        effective_book_count: evaluation.effectiveBookCount,
        target_quote_age_seconds: evaluation.targetQuoteAgeSeconds,
        is_actionable: true,
        rejection_reasons: [],
      })
    }

    // Why the rest did not qualify — aggregated, not row-per-evaluation.
    for (const evaluation of analysis.evaluations) {
      if (evaluation.isActionable) continue
      for (const reason of evaluation.rejectionReasons) {
        rejectionCounts.set(reason, (rejectionCounts.get(reason) ?? 0) + 1)
      }
    }

    // Anchor fair probabilities → later reconstruct the closing line for CLV.
    for (const fair of analysis.anchor.probabilities) {
      fairProbRows.push({
        event_id: eventId,
        market: "h2h",
        outcome: fair.outcome,
        observed_at: fairProbBucket,
        commence_time: commenceTime,
        fair_probability: fair.probability,
        anchor_mode: analysis.anchor.mode,
        effective_book_count: analysis.anchor.effectiveBookCount,
      })
    }
  }

  const rejectionRows = [...rejectionCounts.entries()].map(([reason, count]) => ({
    observed_at: asOf,
    sport_key: sportKey,
    reason,
    count,
  }))

  const swallow = (label: string) => (result: { error: { message: string } | null }) => {
    if (result.error) console.error(`edge telemetry (${label}) failed:`, result.error.message)
  }

  if (signalRows.length > 0) {
    void admin
      .from("edge_signals")
      .upsert(signalRows, { onConflict: "event_id,market,bookmaker,outcome,observed_at", ignoreDuplicates: true })
      .then(swallow("signals"))
  }
  if (fairProbRows.length > 0) {
    void admin
      .from("market_fair_probs")
      .upsert(fairProbRows, { onConflict: "event_id,market,outcome,observed_at", ignoreDuplicates: true })
      .then(swallow("fair_probs"))
  }
  if (rejectionRows.length > 0) {
    void admin
      .from("edge_rejections")
      .upsert(rejectionRows, { onConflict: "observed_at,sport_key,reason", ignoreDuplicates: true })
      .then(swallow("rejections"))
  }

  // Occasional retention pruning so the free tier stays healthy.
  if (Math.random() < 0.02) {
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString()
    void admin.from("market_fair_probs").delete().lt("observed_at", cutoff).then(() => undefined)
    void admin.from("edge_rejections").delete().lt("observed_at", cutoff).then(() => undefined)
    // edge_signals are the training set — keep settled ones, prune only stale
    // unsettled rows whose event is long past.
    void admin
      .from("edge_signals")
      .delete()
      .is("won", null)
      .lt("commence_time", cutoff)
      .then(() => undefined)
  }
}
