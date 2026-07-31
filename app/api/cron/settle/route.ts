import { NextResponse } from "next/server"
import { runSettlement } from "@/lib/markets/settlement"

export const dynamic = "force-dynamic"
export const maxDuration = 60

/**
 * Scheduled settlement. Protected by CRON_SECRET (or Vercel's own cron header).
 * Idempotent — safe to retry. Add to vercel.json crons, e.g. every 6 hours:
 *   { "path": "/api/cron/settle", "schedule": "0 *​/6 * * *" }
 */
function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  // Vercel Cron sends this header; a manual trigger uses the bearer secret.
  if (request.headers.get("x-vercel-cron") === "1") return true
  if (!secret) return false
  return request.headers.get("authorization") === `Bearer ${secret}`
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  try {
    const result = await runSettlement()
    return NextResponse.json(result, { status: result.ok ? 200 : 503 })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "settlement failed" },
      { status: 500 },
    )
  }
}
