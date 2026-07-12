"use client"

import { TrendingUp, Zap, Clock, Activity } from "lucide-react"

interface StatsBarProps {
  totalOpportunities: number
  updateCount: number
  avgArbitrage: number
}

export function StatsBar({ totalOpportunities, updateCount, avgArbitrage }: StatsBarProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      <div className="bg-card border border-border rounded-lg p-3 flex items-center gap-3 hover:border-orange-500/30 transition-colors">
        <div className="p-2 bg-orange-500/10 rounded-lg">
          <TrendingUp className="h-4 w-4 text-orange-500" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Opportunities</p>
          <p className="font-bold text-lg">{totalOpportunities}</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-3 flex items-center gap-3 hover:border-orange-500/30 transition-colors">
        <div className="p-2 bg-amber-500/10 rounded-lg">
          <Activity className="h-4 w-4 text-amber-500" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Avg edge</p>
          <p className="font-bold text-lg text-orange-500">+{avgArbitrage.toFixed(1)}%</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-3 flex items-center gap-3 hover:border-orange-500/30 transition-colors">
        <div className="p-2 bg-orange-400/10 rounded-lg">
          <Zap className="h-4 w-4 text-orange-400" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Updates</p>
          <p className="font-bold text-lg">{updateCount}</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-3 flex items-center gap-3 hover:border-orange-500/30 transition-colors">
        <div className="p-2 bg-amber-400/10 rounded-lg">
          <Clock className="h-4 w-4 text-amber-400" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Auto-refresh</p>
          <p className="font-bold text-lg">15s</p>
        </div>
      </div>
    </div>
  )
}
