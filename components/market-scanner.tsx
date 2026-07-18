"use client"

import { useEffect, useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ConnectionStatus } from "@/components/connection-status"
import { CountdownTimer } from "@/components/countdown-timer"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { ProfitCalculator } from "@/components/profit-calculator"
import { QuickActionButton } from "@/components/quick-action-button"
import { SoundToggle } from "@/components/sound-toggle"
import { Sparkline } from "@/components/sparkline"
import { OnboardingPanel } from "@/components/onboarding-panel"
import { useOddsWebSocket, type OddsUpdate } from "@/hooks/use-odds-websocket"
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ExternalLink,
  Flame,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Search,
  X,
  Zap,
  HelpCircle,
} from "lucide-react"

const leagueColors: Record<string, string> = {
  NFL: "bg-green-600",
  NBA: "bg-orange-500",
  MLB: "bg-red-500",
  NHL: "bg-blue-600",
  CFB: "bg-green-700",
  NCAAB: "bg-orange-600",
  UFC: "bg-red-600",
  MLS: "bg-purple-600",
  WNBA: "bg-orange-400",
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
  "Hard Rock Bet": "HRB",
  Ballybet: "BALLY",
  Fliff: "FLIFF",
}

type SortField = "edge" | "time" | "move"
type EdgeFilter = "all" | "arbs" | "ev" | "near"

/** Decimal odds → American display, e.g. 2.10 → "+110", 1.80 → "-125". */
function decimalToAmerican(decimal: number): string {
  if (!Number.isFinite(decimal) || decimal <= 1) return ""
  return decimal >= 2 ? `+${Math.round((decimal - 1) * 100)}` : `${Math.round(-100 / (decimal - 1))}`
}

/** Kind-aware ranking for the "edge" sort: arbitrage > +EV (ev×conf) > watch. */
function edgeRank(o: OddsUpdate): number {
  if (o.kind === "arbitrage") return 1_000_000 + o.arbitrage
  if (o.kind === "positive_ev") return 1_000 + (o.edge ? (o.edge.netEvPct * o.edge.confidence) / 100 : 0)
  return o.arbitrage // watch: negative gap-to-arb
}

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

/** 0–100: how close a market is to a guaranteed arb (edge 0 = 100%, -3% ≈ 0%). */
function proximityPct(edge: number): number {
  if (edge >= 0) return 100
  return Math.max(4, Math.min(100, ((3 + edge) / 3) * 100))
}

export function MarketScanner() {
  const [filter, setFilter] = useState("all")
  const [edgeFilter, setEdgeFilter] = useState<EdgeFilter>("all")
  const [query, setQuery] = useState("")
  const [sortField, setSortField] = useState<SortField>("edge")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const { opportunities, allOpportunities, sources, isConnected, isLoading, error, lastUpdate, soundEnabled, setSoundEnabled } =
    useOddsWebSocket(filter)

  const notConfigured = sources.find((s) => s.id === "odds-api" && !s.enabled)
  const sourceError = sources.find((s) => s.enabled && !s.ok)

  // Restore filter + sort from the URL (shareable / survives reload).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const league = params.get("league")
    if (league) setFilter(league)
    const sort = params.get("sort")
    if (sort === "edge" || sort === "time" || sort === "move") setSortField(sort)
    const dir = params.get("dir")
    if (dir === "asc" || dir === "desc") setSortDir(dir)
  }, [])

  const writeUrl = (updates: Record<string, string | null>) => {
    const url = new URL(window.location.href)
    for (const [k, v] of Object.entries(updates)) {
      if (v === null) url.searchParams.delete(k)
      else url.searchParams.set(k, v)
    }
    window.history.replaceState(null, "", url)
  }

  const selectFilter = (league: string) => {
    setFilter(league)
    writeUrl({ league: league === "all" ? null : league })
  }

  const leagues = [...new Set(allOpportunities.map((o) => o.league))].sort()
  const leagueCounts = allOpportunities.reduce<Record<string, number>>((acc, o) => {
    acc[o.league] = (acc[o.league] ?? 0) + 1
    return acc
  }, {})

  const toggleSort = (field: SortField) => {
    const nextDir = sortField === field ? (sortDir === "desc" ? "asc" : "desc") : "desc"
    setSortField(field)
    setSortDir(nextDir)
    writeUrl({ sort: field, dir: nextDir })
  }

  const rows = useMemo(() => {
    let list = opportunities
    if (edgeFilter === "arbs") list = list.filter((o) => o.kind === "arbitrage")
    else if (edgeFilter === "ev") list = list.filter((o) => o.kind === "positive_ev")
    else if (edgeFilter === "near") list = list.filter((o) => o.kind !== "arbitrage" && o.arbitrage >= -1)
    const q = query.trim().toLowerCase()
    if (q) list = list.filter((o) => o.matchup.toLowerCase().includes(q) || o.league.toLowerCase().includes(q))

    const dir = sortDir === "desc" ? -1 : 1
    return [...list].sort((a, b) => {
      if (sortField === "edge") return (edgeRank(a) - edgeRank(b)) * dir
      if (sortField === "move") {
        const av = a.edgeDelta1h ?? Number.NEGATIVE_INFINITY
        const bv = b.edgeDelta1h ?? Number.NEGATIVE_INFINITY
        if (av === bv) return 0
        return (av - bv) * dir
      }
      return (new Date(a.eventTime).getTime() - new Date(b.eventTime).getTime()) * dir
    })
  }, [opportunities, edgeFilter, query, sortField, sortDir])

  const arbs = allOpportunities.filter((o) => o.kind === "arbitrage")
  const evPlays = allOpportunities.filter((o) => o.kind === "positive_ev")
  const bestEv = evPlays.length > 0 ? Math.max(...evPlays.map((o) => o.edge?.netEvPct ?? 0)) : null
  const bestEdge = allOpportunities.length > 0 ? Math.max(...allOpportunities.map((o) => o.arbitrage)) : null
  // Prioritise showing the hottest actionable signal: arbs, then +EV, then closest gap.
  const hot = [...opportunities].sort((a, b) => edgeRank(b) - edgeRank(a)).slice(0, 3)

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
      <OnboardingPanel />

      {/* Market overview */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <StatTile label="Live markets" value={String(allOpportunities.length)} />
        <StatTile label="Arbitrage" value={String(arbs.length)} accent={arbs.length > 0 ? "green" : undefined} />
        <StatTile label="+EV plays" value={String(evPlays.length)} accent={evPlays.length > 0 ? "green" : undefined} />
        <StatTile
          label="Best net EV"
          value={bestEv === null ? "—" : `+${bestEv.toFixed(2)}%`}
          accent={bestEv !== null ? "green" : undefined}
        />
        <StatTile
          label="Best arb gap"
          value={bestEdge === null ? "—" : `${bestEdge >= 0 ? "+" : ""}${bestEdge.toFixed(2)}%`}
          accent={bestEdge !== null && bestEdge > 0 ? "green" : bestEdge !== null && bestEdge >= -0.5 ? "amber" : undefined}
        />
      </div>

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

      {/* Hot strip */}
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
              <span className={`font-semibold tabular-nums ${edgeColor(o)}`}>{headlineValue(o)}</span>
            </button>
          ))}
        </div>
      )}

      {/* Toolbar: search + edge quick-filters + connection */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search team or league…"
              aria-label="Search markets"
              className="h-8 w-44 rounded-lg border border-border bg-card pl-8 pr-7 text-xs outline-none transition-colors focus-visible:border-orange-500/60 focus-visible:ring-1 focus-visible:ring-orange-500/40 sm:w-52"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-0.5 text-xs">
            {(["all", "arbs", "ev", "near"] as EdgeFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setEdgeFilter(f)}
                aria-pressed={edgeFilter === f}
                className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                  edgeFilter === f ? "bg-orange-500 text-white" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {f === "all" ? "All" : f === "arbs" ? "Arbs" : f === "ev" ? "+EV" : "Near (<1%)"}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <SoundToggle enabled={soundEnabled} onToggle={setSoundEnabled} />
          <ConnectionStatus isConnected={isConnected} lastUpdate={lastUpdate} />
        </div>
      </div>

      {/* Scanner table */}
      {isLoading && allOpportunities.length === 0 ? (
        <SkeletonTable />
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
          ) : query ? (
            <p className="text-sm text-muted-foreground">No markets match “{query}”.</p>
          ) : allOpportunities.length > 0 ? (
            <p className="text-sm text-muted-foreground">No markets match this filter. Try &quot;All&quot;.</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              No upcoming games have posted lines yet — check back closer to game day.
            </p>
          )}
        </Card>
      ) : (
        <div className="overflow-auto rounded-lg border border-border max-h-[72vh]">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-border bg-muted/95 text-left text-xs text-muted-foreground backdrop-blur">
                <th className="px-3 py-2.5 font-medium">Game</th>
                <th className="px-3 py-2.5 font-medium">Best lines</th>
                <th className="px-3 py-2.5 font-medium">
                  <span className="flex items-center gap-1">
                    <button onClick={() => toggleSort("edge")} className="flex items-center gap-1 hover:text-foreground">
                      Edge <SortIcon field="edge" />
                    </button>
                    <HelpTip label="Edge">
                      <strong>+EV%</strong> = expected return per $1 over many bets (green). <strong>ARB%</strong> = profit
                      locked in right now. A negative <strong>gap</strong> = how far the market still is from an arb.
                    </HelpTip>
                  </span>
                </th>
                <th className="hidden px-3 py-2.5 font-medium lg:table-cell">
                  <span className="flex items-center gap-1">
                    <button onClick={() => toggleSort("move")} className="flex items-center gap-1 hover:text-foreground">
                      Move 1h <SortIcon field="move" />
                    </button>
                    <HelpTip label="Move 1h">
                      How the edge shifted in the last hour. Green means it&apos;s moving toward a live arbitrage. Builds up as
                      history accrues.
                    </HelpTip>
                  </span>
                </th>
                <th className="hidden px-3 py-2.5 font-medium sm:table-cell">
                  <button onClick={() => toggleSort("time")} className="flex items-center gap-1 hover:text-foreground">
                    Starts <SortIcon field="time" />
                  </button>
                </th>
                <th className="hidden px-3 py-2.5 font-medium md:table-cell">Age</th>
                <th className="w-8 px-2 py-2.5" aria-label="Expand" />
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

      <p className="text-center text-[11px] text-muted-foreground">
        Showing {rows.length} of {allOpportunities.length} markets · odds can change between refresh and placement — verify before you stake.
      </p>
    </div>
  )
}

/** Small "what's this?" affordance for the board's jargon. */
function HelpTip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={`What is ${label}?`}
            onClick={(e) => e.stopPropagation()}
            className="text-muted-foreground/60 transition-colors hover:text-foreground"
          >
            <HelpCircle className="h-3 w-3" aria-hidden="true" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-60 text-xs leading-relaxed">{children}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

function StatTile({ label, value, accent }: { label: string; value: string; accent?: "green" | "amber" }) {
  const valueColor =
    accent === "green" ? "text-green-600 dark:text-green-400" : accent === "amber" ? "text-amber-600 dark:text-amber-400" : ""
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`text-lg font-bold tabular-nums ${valueColor}`}>{value}</p>
    </div>
  )
}

function SkeletonTable() {
  return (
    <div className="overflow-hidden rounded-lg border border-border" aria-hidden="true">
      <div className="border-b border-border bg-muted/40 px-3 py-2.5">
        <div className="h-3 w-24 rounded bg-muted-foreground/20" />
      </div>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center justify-between gap-4 border-b border-border px-3 py-3.5 last:border-0">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-muted-foreground/20" />
            <div className="space-y-1.5">
              <div className="h-3 w-40 animate-pulse rounded bg-muted-foreground/20" />
              <div className="h-2 w-12 animate-pulse rounded bg-muted-foreground/10" />
            </div>
          </div>
          <div className="h-3 w-16 animate-pulse rounded bg-muted-foreground/20" />
        </div>
      ))}
    </div>
  )
}

function ScannerRow({ o, expanded, onToggle }: { o: OddsUpdate; expanded: boolean; onToggle: () => void }) {
  const isArb = o.kind === "arbitrage"
  const isEv = o.kind === "positive_ev"
  const age = oldestFreshness(o)

  return (
    <>
      <tr
        onClick={onToggle}
        className={`cursor-pointer border-b border-border transition-colors hover:bg-muted/50 ${
          o.justUpdated ? "animate-flash" : ""
        } ${expanded ? "bg-muted/40" : ""}`}
      >
        <td className="px-3 py-2.5">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 flex-shrink-0 rounded-full ${leagueColors[o.league] || "bg-gray-500"}`} aria-hidden="true" />
            <div className="min-w-0">
              <div className="truncate font-medium">{o.matchup}</div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span>{o.league}</span>
                <KindChip o={o} />
              </div>
            </div>
          </div>
        </td>
        <td className="px-3 py-2.5">
          <div className="space-y-0.5">
            {o.platforms.slice(0, 3).map((p, i) => (
              <div key={i} className="flex items-center gap-1.5 text-xs">
                <span className="w-9 text-muted-foreground">{abbr(p.name)}</span>
                <span className="font-semibold tabular-nums">{p.odds}%</span>
              </div>
            ))}
          </div>
        </td>
        <td className="px-3 py-2.5">
          {isEv && o.edge ? (
            <>
              <div className={`flex items-center gap-1 font-semibold tabular-nums ${edgeColor(o)}`}>
                +{o.edge.netEvPct.toFixed(2)}%
              </div>
              <div className="text-[11px] text-muted-foreground">net EV · SQ {o.edge.confidence}</div>
              {/* confidence bar */}
              <div className="mt-1 h-1 w-16 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${o.edge.confidence}%` }} />
              </div>
            </>
          ) : (
            <>
              <div className={`flex items-center gap-1 font-semibold tabular-nums ${edgeColor(o)}`}>
                {fmtEdge(o.arbitrage)}
                {isArb && o.suspect && <AlertTriangle className="h-3 w-3" aria-hidden="true" />}
              </div>
              <div className="text-[11px] text-muted-foreground">{isArb ? (o.suspect ? "verify" : "arb") : "gap"}</div>
              {/* distance-to-arb bar */}
              <div className="mt-1 h-1 w-16 overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full ${isArb ? (o.suspect ? "bg-red-500" : "bg-green-500") : o.arbitrage >= -0.5 ? "bg-amber-500" : "bg-muted-foreground/40"}`}
                  style={{ width: `${proximityPct(o.arbitrage)}%` }}
                />
              </div>
            </>
          )}
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
              {o.edge && (
                <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                      <Zap className="h-4 w-4" aria-hidden="true" /> +{o.edge.netEvPct.toFixed(2)}% net EV
                      <HelpTip label="net EV">
                        Expected return per $1 over many identical bets, after an uncertainty haircut and an execution buffer.
                        Deliberately more conservative than raw EV. Not a promise on this one bet.
                      </HelpTip>
                    </span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      Signal quality {o.edge.confidence}/100
                      <HelpTip label="Signal quality">
                        A <strong>data/model-quality</strong> score — book depth, agreement, sharp-anchor share, freshness,
                        timing. It is <strong>not</strong> the chance this bet wins.
                      </HelpTip>
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm font-medium">
                    {o.edge.bookmaker} · {o.edge.outcome}{" "}
                    <span className="tabular-nums text-muted-foreground">{decimalToAmerican(o.edge.decimal)}</span>
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground sm:grid-cols-3">
                    <span className="flex items-center gap-1">
                      Fair win prob:{" "}
                      <span className="tabular-nums text-foreground">{(o.edge.fairProbability * 100).toFixed(1)}%</span>
                      <HelpTip label="Fair win probability">
                        The true chance of this outcome after stripping the vig from a target-excluded sharp/consensus anchor
                        (the book we&apos;re judging is left out of its own benchmark).
                      </HelpTip>
                    </span>
                    <span className="flex items-center gap-1">
                      Conservative:{" "}
                      <span className="tabular-nums text-foreground">
                        {(o.edge.conservativeFairProbability * 100).toFixed(1)}%
                      </span>
                      <HelpTip label="Conservative probability">
                        Fair probability minus an uncertainty haircut. Kelly sizing uses this lower number, not the optimistic
                        point estimate.
                      </HelpTip>
                    </span>
                    <span className="flex items-center gap-1">
                      Suggested stake:{" "}
                      <span className="tabular-nums text-foreground">
                        {(o.edge.kellyStakeFraction * 100).toFixed(2)}% bankroll
                      </span>
                      <HelpTip label="Suggested stake">
                        Conservative capped fractional Kelly ({o.edge.profile} profile) on the conservative probability. A
                        bankroll-sizing reference, not a required stake.
                      </HelpTip>
                    </span>
                    <span className="flex items-center gap-1">
                      Anchor:{" "}
                      <span className="text-foreground">
                        {o.edge.anchorSource === "sharp"
                          ? (o.edge.anchorBookmakers[0] ?? "Sharp book")
                          : `Consensus (${o.edge.effectiveBookCount.toFixed(1)} books)`}
                      </span>
                      <HelpTip label="Anchor">
                        Whose line defined the true odds. Pinnacle is the sharp book pros bet into; Consensus blends multiple
                        fresh books. The target book is always excluded from its own anchor.
                      </HelpTip>
                    </span>
                    <span className="flex items-center gap-1">
                      Raw EV: <span className="tabular-nums text-muted-foreground">+{o.edge.rawEvPct.toFixed(2)}%</span>
                      <HelpTip label="Raw EV">
                        The unadjusted point-estimate edge, before the uncertainty haircut and execution buffer. Shown for
                        reference — net EV is the honest number.
                      </HelpTip>
                    </span>
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Estimated long-run edge over many bets — not guaranteed on any single one, which can lose. Signal quality
                    is data/model quality, not a win probability. Verify the line before staking.
                  </p>
                </div>
              )}
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

/** Headline figure for hot strip: EV% for +EV rows, arb/gap otherwise. */
function headlineValue(o: OddsUpdate): string {
  if (o.kind === "positive_ev" && o.edge) return `+${o.edge.netEvPct.toFixed(2)}% EV`
  return fmtEdge(o.arbitrage)
}

function edgeColor(o: OddsUpdate): string {
  if (o.kind === "arbitrage") return o.suspect ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"
  if (o.kind === "positive_ev") return "text-emerald-600 dark:text-emerald-400"
  if (o.arbitrage >= -0.5) return "text-amber-600 dark:text-amber-400"
  return "text-muted-foreground"
}

function KindChip({ o }: { o: OddsUpdate }) {
  if (o.kind === "arbitrage") {
    return o.suspect ? (
      <span className="rounded bg-red-500/15 px-1 py-0.5 text-[10px] font-semibold text-red-600 dark:text-red-400">VERIFY</span>
    ) : (
      <span className="rounded bg-green-500/15 px-1 py-0.5 text-[10px] font-semibold text-green-600 dark:text-green-400">ARB</span>
    )
  }
  if (o.kind === "positive_ev") {
    return (
      <span className="rounded bg-emerald-500/15 px-1 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
        +EV
      </span>
    )
  }
  return null
}
