"use client"

import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Copy, ExternalLink, Check, Sparkles } from "lucide-react"
import { useOddsWebSocket, type OddsUpdate } from "@/hooks/use-odds-websocket"
import { CountdownTimer } from "@/components/countdown-timer"
import { RiskIndicator } from "@/components/risk-indicator"
import { QuickActionButton } from "@/components/quick-action-button"
import { ConnectionStatus } from "@/components/connection-status"
import { OddsChangeIndicator } from "@/components/odds-change-indicator"
import { ProfitCalculator } from "@/components/profit-calculator"
import { StatsBar } from "@/components/stats-bar"
import { SoundToggle } from "@/components/sound-toggle"
import { useState } from "react"

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
}

const leagueColors: Record<string, string> = {
  NFL: "bg-green-600",
  NBA: "bg-orange-500",
  MLB: "bg-red-500",
  NHL: "bg-blue-600",
  CFB: "bg-green-700",
  NCAAB: "bg-orange-600",
  UFC: "bg-red-600",
  Soccer: "bg-purple-500",
  Politics: "bg-gray-700",
}

interface ArbitrageCardsProps {
  filter?: string
  showStats?: boolean
  limit?: number
}

export function ArbitrageCards({ filter, showStats = true, limit }: ArbitrageCardsProps) {
  const {
    opportunities,
    sources,
    degraded,
    isConnected,
    isLoading,
    error,
    lastUpdate,
    updateCount,
    soundEnabled,
    setSoundEnabled,
  } = useOddsWebSocket(filter)

  const avgArbitrage =
    opportunities.length > 0 ? opportunities.reduce((sum, o) => sum + o.arbitrage, 0) / opportunities.length : 0
  const visibleOpportunities = limit ? opportunities.slice(0, limit) : opportunities

  const notConfigured = sources.find((s) => s.id === "odds-api" && !s.enabled)
  const sourceError = sources.find((s) => s.enabled && !s.ok)

  return (
    <div className="space-y-4">
      {showStats && (
        <StatsBar totalOpportunities={opportunities.length} updateCount={updateCount} avgArbitrage={avgArbitrage} />
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground">Arbitrage opportunities ({opportunities.length})</h2>
        <div className="flex items-center gap-2">
          <SoundToggle enabled={soundEnabled} onToggle={setSoundEnabled} />
          <ConnectionStatus isConnected={isConnected} lastUpdate={lastUpdate} />
        </div>
      </div>

      {isLoading && opportunities.length === 0 ? (
        <div className="space-y-4">
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
                sportsbook arbitrage.
              </p>
            </>
          ) : sourceError || error ? (
            <>
              <p className="text-muted-foreground">Couldn&apos;t reach the market data provider.</p>
              <p className="text-sm text-muted-foreground mt-1">{sourceError?.message ?? error}</p>
            </>
          ) : (
            <>
              <p className="text-muted-foreground">No arbitrage right now for this filter.</p>
              <p className="text-sm text-muted-foreground mt-1">
                Efficient markets rarely misprice — check back, or try &quot;All&quot;.
              </p>
            </>
          )}
        </Card>
      ) : (
        <div className="space-y-4">
          {visibleOpportunities.map((opp) => (
            <ArbitrageCard key={opp.id} opportunity={opp} />
          ))}
          {limit && opportunities.length > limit && (
            <Button asChild variant="outline" className="w-full bg-transparent">
              <Link href="/arbitrage">View all opportunities</Link>
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

function ArbitrageCard({ opportunity }: { opportunity: OddsUpdate }) {
  const [copied, setCopied] = useState(false)

  const copyToClipboard = async () => {
    const text = `${opportunity.matchup}\nArbitrage: +${opportunity.arbitrage.toFixed(2)}%\n${opportunity.platforms.map((p) => `${p.name}: ${p.odds}%`).join("\n")}`
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Card
      className={`overflow-hidden transition-all hover:shadow-md hover:border-orange-500/30 relative ${
        opportunity.isNew
          ? "ring-2 ring-orange-500 animate-in fade-in slide-in-from-top-4 duration-500"
          : opportunity.justUpdated
            ? "ring-1 ring-orange-500/50"
            : ""
      }`}
    >
      {opportunity.isNew && (
        <div className="absolute right-0 top-0 flex items-center gap-1 rounded-bl-lg bg-orange-500 px-2 py-0.5 text-xs font-bold text-white">
          <Sparkles className="h-3 w-3" />
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
            <RiskIndicator level={opportunity.riskLevel} />
          </div>
          <div className="flex items-center gap-2">
            <CountdownTimer eventTime={opportunity.eventTime} />
            <button
              onClick={copyToClipboard}
              className="p-1.5 hover:bg-muted rounded-md transition-colors"
              title={copied ? "Copied!" : "Copy opportunity details"}
              aria-label={copied ? "Opportunity details copied" : "Copy opportunity details"}
            >
              {copied ? (
                <Check className="h-4 w-4 text-orange-500" />
              ) : (
                <Copy className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          </div>
        </div>

        <h3 className="font-semibold text-sm sm:text-base mb-3 text-balance">{opportunity.matchup}</h3>

        <div className="flex flex-wrap items-center justify-between gap-2 text-sm mb-4">
          <span className="text-muted-foreground flex items-center gap-1 text-xs sm:text-sm">
            <span className="text-orange-500 font-medium">$</span> Market:{" "}
            {opportunity.platforms.map((p) => p.name).join(" vs ")}
          </span>
          <Badge variant="outline" className="border-orange-500/30 text-xs text-orange-600 dark:text-orange-400">
            {opportunity.platforms.length}-way
          </Badge>
        </div>

        <div className="flex items-center justify-between mb-3">
          <QuickActionButton platforms={opportunity.platforms} />
          <div className="text-right">
            <span className="text-orange-500 font-bold text-lg sm:text-xl">+{opportunity.arbitrage.toFixed(2)}%</span>
            <p className="text-xs text-muted-foreground">guaranteed edge</p>
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
              <div className="flex items-center gap-2">
                <div className={`w-5 h-5 ${platformColors[platform.name] || "bg-gray-500"} rounded-md flex-shrink-0`} />
                <a
                  href={platform.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs sm:text-sm font-medium flex items-center gap-1 hover:text-orange-500 transition-colors"
                >
                  {platform.name}
                  <ExternalLink className="h-3 w-3 text-muted-foreground" />
                </a>
              </div>
              <div className="flex items-center gap-1">
                <span className="font-semibold text-sm sm:text-base">{platform.odds}%</span>
                <OddsChangeIndicator currentOdds={platform.odds} previousOdds={platform.previousOdds} />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-3 border-t border-border">
          <ProfitCalculator arbitragePercent={opportunity.arbitrage} platforms={opportunity.platforms} />
        </div>
      </CardContent>
    </Card>
  )
}
