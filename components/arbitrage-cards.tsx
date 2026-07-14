"use client"

import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Copy, ExternalLink, Check, Sparkles, Radar, AlertTriangle, Zap } from "lucide-react"
import { useOddsWebSocket, type OddsUpdate } from "@/hooks/use-odds-websocket"
import { CountdownTimer } from "@/components/countdown-timer"
import { RiskIndicator } from "@/components/risk-indicator"
import { QuickActionButton } from "@/components/quick-action-button"
import { ConnectionStatus } from "@/components/connection-status"
import { OddsChangeIndicator } from "@/components/odds-change-indicator"
import { ProfitCalculator } from "@/components/profit-calculator"
import { StatsBar } from "@/components/stats-bar"
import { SoundToggle } from "@/components/sound-toggle"
import { useEffect, useState } from "react"

/** Watch rows this close to a guaranteed edge get flagged as "Almost". */
const NEAR_ARB_THRESHOLD = -0.5

/** Compact "how fresh is this price" label from an ISO timestamp. */
function freshness(iso?: string): string | null {
  if (!iso) return null
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (!Number.isFinite(secs) || secs < 0) return null
  if (secs < 60) return "now"
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  return `${Math.floor(mins / 60)}h ago`
}

const platformColors: Record<string, string> = {
  Kalshi: "bg-green-500",
  Polymarket: "bg-emerald-500",
  FanDuel: "bg-blue-500",
  DraftKings: "bg-orange-500",
  BetMGM: "bg-amber-500",
  Caesars: "bg-yellow-600",
  BetRivers: "bg-sky-500",
  PointsBet: "bg-red-500",
  "William Hill (US)": "bg-teal-500",
  Bovada: "bg-rose-500",
  "MyBookie.ag": "bg-indigo-500",
  BetOnline: "bg-cyan-600",
  "LowVig.ag": "bg-lime-600",
}

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
  Politics: "bg-gray-700",
}

interface ArbitrageCardsProps {
  showStats?: boolean
  /** Show league filter chips derived from the live feed. */
  showFilters?: boolean
  limit?: number
}

export function ArbitrageCards({ showStats = true, showFilters = false, limit }: ArbitrageCardsProps) {
  const [filter, setFilter] = useState("all")
  const {
    opportunities,
    allOpportunities,
    sources,
    isConnected,
    isLoading,
    error,
    lastUpdate,
    updateCount,
    soundEnabled,
    setSoundEnabled,
  } = useOddsWebSocket(filter)

  // Sync the league filter with the URL (shareable + survives reload).
  useEffect(() => {
    if (!showFilters) return
    const param = new URLSearchParams(window.location.search).get("league")
    if (param) setFilter(param)
  }, [showFilters])

  const selectFilter = (league: string) => {
    setFilter(league)
    if (!showFilters) return
    const url = new URL(window.location.href)
    if (league === "all") url.searchParams.delete("league")
    else url.searchParams.set("league", league)
    window.history.replaceState(null, "", url)
  }

  // League chips come from what's actually live — never a hardcoded list.
  const leagues = [...new Set(allOpportunities.map((o) => o.league))].sort()
  const leagueCounts = allOpportunities.reduce<Record<string, number>>((acc, o) => {
    acc[o.league] = (acc[o.league] ?? 0) + 1
    return acc
  }, {})

  const arbs = opportunities.filter((o) => o.kind === "arbitrage")
  const evPlays = opportunities.filter((o) => o.kind === "positive_ev")
  const watch = opportunities.filter((o) => o.kind === "watch")
  const avgArbitrage = arbs.length > 0 ? arbs.reduce((sum, o) => sum + o.arbitrage, 0) / arbs.length : null

  const notConfigured = sources.find((s) => s.id === "odds-api" && !s.enabled)
  const sourceError = sources.find((s) => s.enabled && !s.ok)

  // Compact mode (home page): one blended list, arbs → +EV → watch.
  const visible = limit ? [...arbs, ...evPlays, ...watch].slice(0, limit) : null

  return (
    <div className="space-y-4">
      {showFilters && leagues.length > 1 && (
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

      {showStats && (
        <StatsBar arbCount={arbs.length} watchCount={watch.length} avgArbitrage={avgArbitrage} updateCount={updateCount} />
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground">
          {limit ? "Live markets" : `Arbitrage opportunities (${arbs.length})`}
        </h2>
        <div className="flex items-center gap-2">
          <SoundToggle enabled={soundEnabled} onToggle={setSoundEnabled} />
          <ConnectionStatus isConnected={isConnected} lastUpdate={lastUpdate} />
        </div>
      </div>

      {isLoading && opportunities.length === 0 ? (
        <div className="space-y-4" aria-hidden="true">
          {Array.from({ length: limit ?? 3 }).map((_, i) => (
            <Card key={i} className="h-40 animate-pulse bg-muted/40" />
          ))}
        </div>
      ) : opportunities.length === 0 ? (
        <Card className="p-8 text-center">
          {notConfigured ? (
            <>
              <p className="text-muted-foreground">Live opportunities need a market data key.</p>
              <p className="text-sm text-muted-foreground mt-1">
                Set <code className="rounded bg-muted px-1 py-0.5 text-xs">ODDS_API_KEY</code> to start streaming real
                sportsbook odds.
              </p>
            </>
          ) : sourceError || error ? (
            <>
              <p className="text-muted-foreground">Couldn&apos;t reach the market data provider.</p>
              <p className="text-sm text-muted-foreground mt-1">{sourceError?.message ?? error}</p>
            </>
          ) : (
            <>
              <p className="text-muted-foreground">No upcoming markets for this filter right now.</p>
              <p className="text-sm text-muted-foreground mt-1">
                New games appear as books post lines — usually the night before.
              </p>
            </>
          )}
        </Card>
      ) : visible ? (
        // Home page: compact blended list
        <div className="space-y-4">
          {visible.map((opp) => (
            <ArbitrageCard key={opp.id} opportunity={opp} />
          ))}
          <Button asChild variant="outline" className="w-full bg-transparent">
            <Link href="/arbitrage">View all live markets</Link>
          </Button>
        </div>
      ) : (
        // Dashboard: arbs section, then market watch
        <div className="space-y-4">
          {arbs.length === 0 ? (
            <Card className="border-dashed p-6 text-center">
              <p className="text-sm text-muted-foreground">
                No guaranteed arbitrage at this moment — real cross-book edges are rare and brief.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                The markets below are being watched live; anything that crosses into profit jumps up here instantly.
              </p>
            </Card>
          ) : (
            arbs.map((opp) => <ArbitrageCard key={opp.id} opportunity={opp} />)
          )}

          {evPlays.length > 0 && (
            <>
              <div className="flex items-center gap-2 pt-4">
                <Zap className="h-4 w-4 text-emerald-500" aria-hidden="true" />
                <h2 className="text-sm font-medium text-muted-foreground">
                  Positive EV · estimated long-run edge ({evPlays.length})
                </h2>
              </div>
              {evPlays.map((opp) => (
                <ArbitrageCard key={opp.id} opportunity={opp} />
              ))}
            </>
          )}

          {watch.length > 0 && (
            <>
              <div className="flex items-center gap-2 pt-4">
                <Radar className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <h2 className="text-sm font-medium text-muted-foreground">
                  Market watch · best lines across books ({watch.length})
                </h2>
              </div>
              {watch.map((opp) => (
                <ArbitrageCard key={opp.id} opportunity={opp} />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}

/** Decimal odds → American display, e.g. 2.10 → "+110". */
function decimalToAmerican(decimal: number): string {
  if (!Number.isFinite(decimal) || decimal <= 1) return ""
  return decimal >= 2 ? `+${Math.round((decimal - 1) * 100)}` : `${Math.round(-100 / (decimal - 1))}`
}

function ArbitrageCard({ opportunity }: { opportunity: OddsUpdate }) {
  const [copied, setCopied] = useState(false)
  const isArb = opportunity.kind === "arbitrage"
  const isEv = opportunity.kind === "positive_ev"
  const nearArb = !isArb && !isEv && opportunity.arbitrage >= NEAR_ARB_THRESHOLD

  const copyToClipboard = async () => {
    const text = `${opportunity.matchup}\nEdge: ${opportunity.arbitrage >= 0 ? "+" : ""}${opportunity.arbitrage.toFixed(2)}%\n${opportunity.platforms.map((p) => `${p.name}: ${p.odds}%`).join("\n")}`
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Card
      className={`overflow-hidden transition-all hover:shadow-md hover:border-orange-500/30 relative ${
        isArb && opportunity.isNew
          ? "ring-2 ring-orange-500 animate-in fade-in slide-in-from-top-4 duration-500"
          : isEv
            ? "ring-1 ring-emerald-500/40"
            : nearArb
              ? "ring-1 ring-amber-500/60"
              : opportunity.justUpdated
                ? "ring-1 ring-orange-500/30"
                : ""
      }`}
    >
      {isArb && opportunity.isNew && (
        <div className="absolute right-0 top-0 flex items-center gap-1 rounded-bl-lg bg-orange-500 px-2 py-0.5 text-xs font-bold text-white">
          <Sparkles className="h-3 w-3" aria-hidden="true" />
          NEW
        </div>
      )}

      <CardContent className="p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Badge
              variant="secondary"
              className={`text-xs font-medium text-white ${leagueColors[opportunity.league] || "bg-gray-500"}`}
            >
              {opportunity.league}
            </Badge>
            {isArb && opportunity.suspect ? (
              <Badge variant="outline" className="gap-1 text-xs border-red-500/50 text-red-600 dark:text-red-400">
                <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                Verify
              </Badge>
            ) : isArb ? (
              <RiskIndicator level={opportunity.riskLevel} />
            ) : isEv ? (
              <Badge variant="outline" className="gap-1 text-xs border-emerald-500/50 text-emerald-600 dark:text-emerald-400">
                <Zap className="h-3 w-3" aria-hidden="true" /> +EV
              </Badge>
            ) : nearArb ? (
              <Badge variant="outline" className="text-xs border-amber-500/50 text-amber-600 dark:text-amber-400">
                Almost
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs text-muted-foreground">
                Watching
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <CountdownTimer eventTime={opportunity.eventTime} />
            <button
              onClick={copyToClipboard}
              className="p-1.5 hover:bg-muted rounded-md transition-colors"
              title={copied ? "Copied!" : "Copy market details"}
              aria-label={copied ? "Market details copied" : "Copy market details"}
            >
              {copied ? (
                <Check className="h-4 w-4 text-orange-500" aria-hidden="true" />
              ) : (
                <Copy className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        <h3 className="font-semibold text-sm sm:text-base mb-3 text-balance">{opportunity.matchup}</h3>

        {isArb && opportunity.suspect && (
          <div className="mb-3 flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/5 p-2 text-xs text-red-600 dark:text-red-400">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
            <span>Edge is unusually large — almost always a stale or unbettable line. Confirm both prices on the books before staking.</span>
          </div>
        )}

        <div className="flex items-center justify-between mb-3">
          <QuickActionButton platforms={opportunity.platforms} />
          <div className="text-right">
            {isEv && opportunity.edge ? (
              <>
                <span className="text-emerald-600 dark:text-emerald-400 font-bold text-lg sm:text-xl tabular-nums">
                  +{opportunity.edge.evPct.toFixed(2)}%
                </span>
                <p className="text-xs text-muted-foreground">est. EV · {opportunity.edge.confidence}/100</p>
              </>
            ) : isArb ? (
              <>
                <span className="text-orange-500 font-bold text-lg sm:text-xl tabular-nums">
                  +{opportunity.arbitrage.toFixed(2)}%
                </span>
                <p className="text-xs text-muted-foreground">guaranteed edge</p>
              </>
            ) : (
              <>
                <span
                  className={`font-semibold text-base sm:text-lg tabular-nums ${
                    nearArb ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
                  }`}
                >
                  {opportunity.arbitrage.toFixed(2)}%
                </span>
                <p className="text-xs text-muted-foreground">gap to arbitrage</p>
              </>
            )}
          </div>
        </div>

        <div className="space-y-2">
          {opportunity.platforms.map((platform, pIndex) => (
            <div
              key={pIndex}
              className={`flex items-center justify-between py-2 border-t border-border first:border-t-0 transition-colors ${
                platform.previousOdds && platform.odds !== platform.previousOdds ? "bg-orange-500/5" : ""
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className={`w-5 h-5 ${platformColors[platform.name] || "bg-gray-500"} rounded-md flex-shrink-0`}
                  aria-hidden="true"
                />
                <a
                  href={platform.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs sm:text-sm font-medium flex items-center gap-1 hover:text-orange-500 transition-colors truncate"
                >
                  {platform.name}
                  <ExternalLink className="h-3 w-3 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
                </a>
              </div>
              <div className="flex items-center gap-2">
                {freshness(platform.updatedAt) && (
                  <span className="hidden text-[11px] tabular-nums text-muted-foreground/70 sm:inline">
                    {freshness(platform.updatedAt)}
                  </span>
                )}
                <span className="font-semibold text-sm sm:text-base tabular-nums">{platform.odds}%</span>
                <OddsChangeIndicator currentOdds={platform.odds} previousOdds={platform.previousOdds} />
              </div>
            </div>
          ))}
        </div>

        {isArb && (
          <div className="mt-4 pt-3 border-t border-border">
            <ProfitCalculator arbitragePercent={opportunity.arbitrage} platforms={opportunity.platforms} />
          </div>
        )}

        {isEv && opportunity.edge && (
          <div className="mt-4 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3">
            <p className="text-sm font-medium">
              {opportunity.edge.bookmaker} · {opportunity.edge.outcome}{" "}
              <span className="tabular-nums text-muted-foreground">{decimalToAmerican(opportunity.edge.decimal)}</span>
            </p>
            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>
                Fair prob:{" "}
                <span className="tabular-nums text-foreground">{opportunity.edge.fairProbabilityPct.toFixed(1)}%</span>
              </span>
              <span>
                ¼ Kelly:{" "}
                <span className="tabular-nums text-foreground">{opportunity.edge.kellyStakePct.toFixed(2)}% bankroll</span>
              </span>
              <span>
                Fair value:{" "}
                <span className="text-foreground">
                  {opportunity.edge.anchorSource === "sharp" ? (opportunity.edge.anchorBookmaker ?? "Sharp book") : "Consensus"}
                </span>
              </span>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Estimated long-run edge — not guaranteed on any single bet. Verify the line before staking.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
