"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { OpportunitiesResponse, OpportunityDTO, SourceStatus } from "@/lib/markets/types"

/**
 * Live opportunities feed. Polls the server aggregation endpoint (which is
 * itself cached in front of the upstream market APIs) and diffs successive
 * responses so the UI can highlight new and updated rows. The public shape
 * is unchanged from the original mock hook so consuming components are
 * untouched.
 */

export interface OddsUpdate {
  id: string
  matchup: string
  league: string
  category: "sports" | "politics" | "crypto" | "entertainment"
  platforms: {
    name: string
    outcome?: string
    odds: number
    previousOdds?: number
    decimal?: number
    updatedAt?: string
    url: string
  }[]
  arbitrage: number
  kind: "arbitrage" | "watch"
  suspect: boolean
  edgeDelta1h?: number
  edgeDelta6h?: number
  spark?: number[]
  riskLevel: "low" | "medium" | "high"
  eventTime: Date
  lastUpdated: Date
  isNew?: boolean
  justUpdated?: boolean
}

const POLL_INTERVAL_MS = 15_000
const NOTIFICATION_SOUND =
  "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2telekkZQprh9fSufy0sY6Lo/f29jjUsQXrC6P73yZgqITV3rNrv7L10IxU3XZnR4+PN"

function reviveOpportunity(dto: OpportunityDTO): OddsUpdate {
  return {
    ...dto,
    eventTime: new Date(dto.eventTime),
    lastUpdated: new Date(dto.lastUpdated),
  }
}

/** Diff the incoming list against the previous one to flag new/updated rows. */
function diffOpportunities(previous: OddsUpdate[], incoming: OddsUpdate[]): OddsUpdate[] {
  const byId = new Map(previous.map((o) => [o.id, o]))
  return incoming.map((next) => {
    const prev = byId.get(next.id)
    if (!prev) return { ...next, isNew: true }

    let changed = false
    const platforms = next.platforms.map((platform) => {
      const prevPlatform = prev.platforms.find((p) => p.name === platform.name)
      if (prevPlatform && prevPlatform.odds !== platform.odds) {
        changed = true
        return { ...platform, previousOdds: prevPlatform.odds }
      }
      return platform
    })

    return { ...next, platforms, justUpdated: changed || prev.arbitrage !== next.arbitrage }
  })
}

export function useOddsWebSocket(filter?: string) {
  const [opportunities, setOpportunities] = useState<OddsUpdate[]>([])
  const [sources, setSources] = useState<SourceStatus[]>([])
  const [degraded, setDegraded] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const [updateCount, setUpdateCount] = useState(0)
  const [soundEnabled, setSoundEnabled] = useState(false)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const previousRef = useRef<OddsUpdate[]>([])
  const soundRef = useRef(soundEnabled)
  soundRef.current = soundEnabled

  useEffect(() => {
    audioRef.current = new Audio(NOTIFICATION_SOUND)
  }, [])

  const fetchOpportunities = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch("/api/opportunities", { signal, cache: "no-store" })
      if (!res.ok) throw new Error(`Request failed (${res.status})`)
      const data = (await res.json()) as OpportunitiesResponse

      const revived = data.opportunities.map(reviveOpportunity)
      const diffed = diffOpportunities(previousRef.current, revived)
      // Chime only for genuinely new arbitrage — watch rows churn constantly.
      const hasNew = diffed.some((o) => o.isNew && o.kind === "arbitrage") && previousRef.current.length > 0

      previousRef.current = revived
      setOpportunities(diffed)
      setSources(data.sources ?? [])
      setDegraded(Boolean(data.degraded))
      setIsConnected(true)
      setError(null)
      setLastUpdate(new Date())
      setUpdateCount((count) => count + 1)

      if (hasNew && soundRef.current && audioRef.current) {
        audioRef.current.play().catch(() => undefined)
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return
      setIsConnected(false)
      setError(err instanceof Error ? err.message : "Failed to load opportunities")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    fetchOpportunities(controller.signal)
    const interval = setInterval(() => fetchOpportunities(), POLL_INTERVAL_MS)
    return () => {
      controller.abort()
      clearInterval(interval)
    }
  }, [fetchOpportunities])

  const filteredOpportunities = opportunities.filter((opportunity) => {
    if (!filter || filter === "all") return true
    if (filter === "politics") return opportunity.category === "politics"
    return opportunity.league.toLowerCase() === filter.toLowerCase()
  })

  return {
    opportunities: filteredOpportunities,
    allOpportunities: opportunities,
    sources,
    degraded,
    isConnected,
    isLoading,
    error,
    lastUpdate,
    updateCount,
    soundEnabled,
    setSoundEnabled,
  }
}
