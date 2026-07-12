"use client"

import { TrendingUp, Radar, Clock, Activity } from "lucide-react"

interface StatsBarProps {
  arbCount: number
  watchCount: number
  /** Average edge across live arbs; null when there are none. */
  avgArbitrage: number | null
  updateCount: number
}

export function StatsBar({ arbCount, watchCount, avgArbitrage }: StatsBarProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      <div className="bg-card border border-border rounded-lg p-3 flex items-center gap-3 hover:border-orange-500/30 transition-colors">
        <div className="p-2 bg-orange-500/10 rounded-lg">
          <TrendingUp className="h-4 w-4 text-orange-500" aria-hidden="true" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Arbitrage</p>
          <p className="font-bold text-lg tabular-nums">{arbCount}</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-3 flex items-center gap-3 hover:border-orange-500/30 transition-colors">
        <div className="p-2 bg-amber-500/10 rounded-lg">
          <Activity className="h-4 w-4 text-amber-500" aria-hidden="true" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Avg edge</p>
          <p className="font-bold text-lg tabular-nums text-orange-500">
            {avgArbitrage === null ? "—" : `+${avgArbitrage.toFixed(1)}%`}
          </p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-3 flex items-center gap-3 hover:border-orange-500/30 transition-colors">
        <div className="p-2 bg-orange-400/10 rounded-lg">
          <Radar className="h-4 w-4 text-orange-400" aria-hidden="true" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Watching</p>
          <p className="font-bold text-lg tabular-nums">{watchCount}</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-3 flex items-center gap-3 hover:border-orange-500/30 transition-colors">
        <div className="p-2 bg-amber-400/10 rounded-lg">
          <Clock className="h-4 w-4 text-amber-400" aria-hidden="true" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Auto-refresh</p>
          <p className="font-bold text-lg tabular-nums">15s</p>
        </div>
      </div>
    </div>
  )
}
