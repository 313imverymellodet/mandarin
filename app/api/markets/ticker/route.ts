import { NextResponse } from "next/server"
import { getTicker } from "@/lib/markets"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const data = await getTicker()
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" },
    })
  } catch (error) {
    return NextResponse.json(
      { markets: [], generatedAt: new Date().toISOString(), error: error instanceof Error ? error.message : "Unknown error" },
      { status: 502 },
    )
  }
}
