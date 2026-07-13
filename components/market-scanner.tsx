"use client"

import { useEffect, useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ConnectionStatus } from "@/components/connection-status"
import { CountdownTimer } from "@/components/countdown-timer"
import { ProfitCalculator } from "@/components/profit-calculator"
import { QuickActionButton } from "@/components/quick-action-button"
import { SoundToggle } from "@/components/sound-toggle"
import { Sparkline } from "@/components/sparkline"
import { useOddsWebSocket, type OddsUpdate } from "@/hooks/use-odds-websocket"
import { ArrowDown, ArrowUp, ChevronDown, ExternalLink, Flame, AlertTriangle, TrendingUp, TrendingDown } from "lucide-react"

const leagueColors: Record<string, string> = {
  NFL: "bg-green-600",
  NBA: "bg-orange-500",
  MLB: "bg-red-500",
  NHL: "bg-blue-600",
  CFB: "bg-green-700",
  NCAAB: "bg-orange-600",
  UFC: "bg-red-600",
  MLS: "bg-purple-600",
  Soccer: "bg-purple-500",
}

const bookAbbr: Record<string, string> = {
  DraftKings: "DK",
  FanDuel: "FD",
  BetMGM: "MGM",
  Caesars: "CZR",
  BetRivers: "BR",
  "ESPN BET": "ESPN",
  Fanatics: "FAN",
  "Ballybet": "BALLY",
  Fliff: "FLIFF",
}

type SortField = "edge" | "time" | "move"
type EdgeFilter = "all" | "near" | "arbs"

function freshness(iso?: string): string | null {
  if (!iso) return null
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (!Number.isFinite(secs) || secs < 0) return null
  if (secs < 60) return "now"
  const mins = Math.floor(secs / 60)
  return mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h`
}

function abbr(book: string): string {
  return bookAbbr[book] ?? book.slice(0, 4).toUpperCase()
}

function oldestFreshness(o: OddsUpdate): string | null {
  const times = o.platforms.map((p) => p.updatedAt).filter(Boolean) as string[]
  if (times.length === 0) return null
  const oldest = times.reduce((a, b) => (new Date(a).getTime() < new Date(b).getTime() ? a : b))
  return freshness(oldest)
}

export function MarketScanner() {
  const [filter, setFilter] = useState("all")
  const [edgeFilter, setEdgeFilter] = useState<EdgeFilter>("all")
  const [sortField, setSortField] = useState<SortField>("edge")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const { opportunities, allOpportunities, sources, isConnected, isLoading, error, lastUpdate, soundEnabled, setSoundEnabled } =
    useOddsWebSocket(filter)

  const notConfigured = sources.find((s) => s.id === "odds-api" && !s.enabled)
  const sourceError = sources.find((s) => s.enabled && !s.ok)

  // League filter chips + URL sync (shared with the Cards view via ?league=).
  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get("league")
    if (param) setFilter(param)
  }, [])

  const selectFilter = (league: string) => {
    setFilter(league)
    const url = new URL(window.location.href)
    if (league === "all") url.searchParams.delete("league")
    else url.searchParams.set("league", league)
    window.history.replaceState(null, "", url)
  }

  const leagues = [...new Set(allOpportunities.map((o) => o.league))].sort()
  const leagueCounts = allOpportunities.reduce<Record<string, number>>((acc, o) => {
    acc[o.league] = (acc[o.league] ?? 0) + 1
    return acc
  }, {})

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === "desc" ? "asc" : "desc"))
    else {
      setSortField(field)
      setSortDir("desc")
    }
  }

  const rows = useMemo(() => {
    let list = opportunities
    if (edgeFilter === "arbs") list = list.filter((o) => o.kind === "arbitrage")
    else if (edgeFilter === "near") list = list.filter((o) => o.arbitrage >= -1)

    const dir = sortDir === "desc" ? -1 : 1
    return [...list].sort((a, b) => {
      if (sortField === "edge") return (a.arbitrage - b.arbitrage) * dir
      if (sortField === "move") {
        // Markets without history sort to the bottom regardless of direction.
        const av = a.edgeDelta1h ?? Number.NEGATIVE_INFINITY
        const bv = b.edgeDelta1h ?? Number.NEGATIVE_INFINITY
        if (av === bv) return 0
        return (av - bv) * dir
      }
      return (new Date(a.eventTime).getTime() - new Date(b.eventTime).getTime()) * dir
    })
  }, [opportunities, edgeFilter, sortField, sortDir])

  const arbs = allOpportunities.filter((o) => o.kind === "arbitrage")
  const hot = [...opportunities].sort((a, b) => b.arbitrage - a.arbitrage).slice(0, 3)

  const SortIcon = ({ field }: { field: SortField }) =>
    sortField === field ? (
      sortDir === "desc" ? (
        <ArrowDown className="h-3 w-3" aria-hidden="true" />
      ) : (
        <ArrowUp className="h-3 w-3" aria-hidden="true" />
      )
    ) : null

  return (
    <div className="space-y-4">
      {/* League filters */}
      {leagues.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1" role="group" aria-label="Filter by league">
          {["all", ...leagues].map((league) => {
            const count = league === "all" ? allOpportunities.length : (leagueCounts[league] ?? 0)
            const active = filter === league
            return (
              <Button
                key={league}
                variant={active ? "default" : "outline"}
                size="sm"
                onClick={() => selectFilter(league)}
                aria-pressed={active}
                className={`flex-shrink-0 ${active ? "bg-orange-500 hover:bg-orange-600 text-white" : "bg-transparent"}`}
              >
                {league === "all" ? "All" : league}
                <span className={`ml-1.5 tabular-nums ${active ? "text-white/70" : "text-muted-foreground"}`}>{count}</span>
              </Button>
            )
          })}
        </div>
      )}

      {/* Hot strip: closest to a guaranteed edge */}
      {hot.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="flex flex-shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground">
            <Flame className="h-3.5 w-3.5 text-orange-500" aria-hidden="true" /> Hottest
          </span>
          {hot.map((o) => (
            <button
              key={`hot-${o.id}`}
              onClick={() => setExpandedId(o.id)}
              className="flex flex-shrink-0 items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs transition-colors hover:border-orange-500/50"
            >
              <span className="max-w-32 truncate font-medium">{o.matchup}</span>
              <span className={`font-semibold tabular-nums ${edgeColor(o)}`}>{fmtEdge(o.arbitrage)}</span>
            </button>
          ))}
        </div>
      )}

      {/* Toolbar: edge quick-filters + connection */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-0.5 text-xs">
          {(["all", "near", "arbs"] as EdgeFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setEdgeFilter(f)}
              aria-pressed={edgeFilter === f}
              className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                edgeFilter === f ? "bg-orange-500 text-white" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f === "all" ? "All" : f === "near" ? "Near (<1%)" : "Arbs only"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <SoundToggle enabled={soundEnabled} onToggle={setSoundEnabled} />
          <ConnectionStatus isConnected={isConnected} lastUpdate={lastUpdate} />
        </div>
      </div>

      {/* Scanner table */}
      {isLoading && rows.length === 0 ? (
        <Card className="h-64 animate-pulse bg-muted/40" aria-hidden="true" />
      ) : rows.length === 0 ? (
        <Card className="p-8 text-center">
          {notConfigured ? (
            <>
              <p className="text-sm text-muted-foreground">Live odds need a market data key.</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Set <code className="rounded bg-muted px-1 py-0.5">ODDS_API_KEY</code> to start streaming odds.
              </p>
            </>
          ) : sourceError || error ? (
            <>
              <p className="flex items-center justify-center gap-2 text-sm text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4" aria-hidden="true" /> Live odds provider is unavailable right now.
              </p>
              <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">{sourceError?.message ?? error}</p>
            </>
          ) : allOpportunities.length > 0 ? (
            <p className="text-sm text-muted-foreground">No markets match this filter. Try &quot;All&quot;.</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              No upcoming games have posted lines yet — check back closer to game day.
            </p>
          )}
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">Game</th>
                <th className="px-3 py-2 font-medium">Best lines</th>
                <th className="px-3 py-2 font-medium">
                  <button onClick={() => toggleSort("edge")} className="flex items-center gap-1 hover:text-foreground">
                    Edge <SortIcon field="edge" />
                  </button>
                </th>
                <th className="hidden px-3 py-2 font-medium lg:table-cell">
                  <button onClick={() => toggleSort("move")} className="flex items-center gap-1 hover:text-foreground">
                    Move 1h <SortIcon field="move" />
                  </button>
                </th>
                <th className="hidden px-3 py-2 font-medium sm:table-cell">
                  <button onClick={() => toggleSort("time")} className="flex items-center gap-1 hover:text-foreground">
                    Starts <SortIcon field="time" />
                  </button>
                </th>
                <th className="hidden px-3 py-2 font-medium md:table-cell">Age</th>
                <th className="w-8 px-2 py-2" aria-label="Expand" />
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => (
                <ScannerRow
                  key={o.id}
                  o={o}
                  expanded={expandedId === o.id}
                  onToggle={() => setExpandedId((id) => (id === o.id ? null : o.id))}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function ScannerRow({ o, expanded, onToggle }: { o: OddsUpdate; expanded: boolean; onToggle: () => void }) {
  const isArb = o.kind === "arbitrage"
  const age = oldestFreshness(o)

  return (
    <>
      <tr
        onClick={onToggle}
        className={`cursor-pointer border-b border-border transition-colors hover:bg-muted/40 ${
          o.justUpdated ? "animate-flash" : ""
        } ${expanded ? "bg-muted/30" : ""}`}
      >
        <td className="px-3 py-2.5">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 flex-shrink-0 rounded-full ${leagueColors[o.league] || "bg-gray-500"}`} aria-hidden="true" />
            <div className="min-w-0">
              <div className="truncate font-medium">{o.matchup}</div>
              <div className="text-xs text-muted-foreground">{o.league}</div>
            </div>
          </div>
        </td>
        <td className="px-3 py-2.5">
          <div className="space-y-0.5">
            {o.platforms.slice(0, 3).map((p, i) => (
              <div key={i} className="flex items-center gap-1.5 text-xs">
                <span className="text-muted-foreground">{abbr(p.name)}</span>
                <span className="font-semibold tabular-nums">{p.odds}%</span>
              </div>
            ))}
          </div>
        </td>
        <td className="px-3 py-2.5">
          <div className={`flex items-center gap-1 font-semibold tabular-nums ${edgeColor(o)}`}>
            {fmtEdge(o.arbitrage)}
            {isArb && o.suspect && <AlertTriangle className="h-3 w-3" aria-hidden="true" />}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {isArb ? (o.suspect ? "verify" : "arb") : "gap"}
          </div>
        </td>
        <td className="hidden px-3 py-2.5 lg:table-cell">
          <MoveCell o={o} />
        </td>
        <td className="hidden px-3 py-2.5 sm:table-cell">
          <CountdownTimer eventTime={o.eventTime} compact />
        </td>
        <td className="hidden px-3 py-2.5 text-xs tabular-nums text-muted-foreground md:table-cell">{age ?? "—"}</td>
        <td className="px-2 py-2.5 text-muted-foreground">
          <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} aria-hidden="true" />
        </td>
      </tr>

      {expanded && (
        <tr className="border-b border-border bg-muted/20">
          <td colSpan={7} className="px-3 py-4">
            <div className="space-y-3">
              {isArb && o.suspect && (
                <div className="flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/5 p-2 text-xs text-red-600 dark:text-red-400">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
                  <span>Edge is unusually large — almost always a stale or unbettable line. Confirm both prices before staking.</span>
                </div>
              )}
              <div className="grid gap-2 sm:grid-cols-2">
                {o.platforms.map((p, i) => (
                  <a
                    key={i}
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2 text-sm transition-colors hover:border-orange-500/40"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate font-medium">{p.outcome ?? p.name}</span>
                      <ExternalLink className="h-3 w-3 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{p.name}</span>
                      <span className="font-semibold tabular-nums">{p.odds}%</span>
                    </span>
                  </a>
                ))}
              </div>
              <div className="flex items-center justify-between gap-2">
                <QuickActionButton platforms={o.platforms} />
                {age && <span className="text-xs text-muted-foreground">prices {age} old</span>}
              </div>
              {isArb && (
                <div className="border-t border-border pt-3">
                  <ProfitCalculator arbitragePercent={o.arbitrage} platforms={o.platforms} />
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

function MoveCell({ o }: { o: OddsUpdate }) {
  const delta = o.edgeDelta1h
  return (
    <div className="flex items-center gap-2">
      {o.spark && o.spark.length >= 2 ? <Sparkline data={o.spark} /> : <span className="text-xs text-muted-foreground/60">—</span>}
      {delta !== undefined && delta !== 0 ? (
        <span
          className={`flex items-center gap-0.5 text-xs font-medium tabular-nums ${
            delta > 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
          }`}
        >
          {delta > 0 ? <TrendingUp className="h-3 w-3" aria-hidden="true" /> : <TrendingDown className="h-3 w-3" aria-hidden="true" />}
          {delta > 0 ? "+" : ""}
          {delta.toFixed(2)}
        </span>
      ) : delta === 0 ? (
        <span className="text-xs text-muted-foreground">flat</span>
      ) : null}
    </div>
  )
}

function fmtEdge(edge: number): string {
  return `${edge >= 0 ? "+" : ""}${edge.toFixed(2)}%`
}

function edgeColor(o: OddsUpdate): string {
  if (o.kind === "arbitrage") return o.suspect ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"
  if (o.arbitrage >= -0.5) return "text-amber-600 dark:text-amber-400"
  return "text-muted-foreground"
}
