import { NextResponse } from "next/server"
import { getOpportunities } from "@/lib/markets"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const data = await getOpportunities()
    return NextResponse.json(data, {
      headers: {
        // Allow CDN/browser to reuse for the cache window; serve stale briefly.
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        opportunities: [],
        sources: [],
        degraded: true,
        generatedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 502 },
    )
  }
}
