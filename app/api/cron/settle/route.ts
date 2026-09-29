import { timingSafeEqual } from "node:crypto"
import { NextResponse } from "next/server"
import { runSettlement } from "@/lib/markets/settlement"

export const dynamic = "force-dynamic"
export const maxDuration = 60

/**
 * Scheduled settlement. Protected by CRON_SECRET: Vercel Cron sends it
 * automatically as `Authorization: Bearer <CRON_SECRET>` once the env var is
 * set. Do NOT trust `x-vercel-cron` — any client can send that header.
 * Idempotent — safe to retry. Add to vercel.json crons, e.g. every 6 hours:
 *   { "path": "/api/cron/settle", "schedule": "0 *​/6 * * *" }
 */
function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const expected = Buffer.from(`Bearer ${secret}`)
  const received = Buffer.from(request.headers.get("authorization") ?? "")
  return received.length === expected.length && timingSafeEqual(received, expected)
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
