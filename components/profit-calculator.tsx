"use client"

import { useState } from "react"
import { Calculator, DollarSign } from "lucide-react"
import { Input } from "@/components/ui/input"

interface ProfitCalculatorProps {
  arbitragePercent: number
  platforms: { name: string; odds: number }[]
}

export function ProfitCalculator({ arbitragePercent, platforms }: ProfitCalculatorProps) {
  const [betAmount, setBetAmount] = useState<string>("100")
  const [isExpanded, setIsExpanded] = useState(false)

  const amount = Number.parseFloat(betAmount) || 0
  const profit = (amount * arbitragePercent) / 100
  const totalReturn = amount + profit

  const totalOdds = platforms.reduce((sum, p) => sum + p.odds, 0)
  const betSplits = platforms.map((p) => ({
    name: p.name,
    bet: Math.round(amount * (p.odds / totalOdds) * 100) / 100,
    odds: p.odds,
  }))

  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-orange-500 transition-colors"
      >
        <Calculator className="h-3.5 w-3.5" />
        <span>Estimate return</span>
      </button>
    )
  }

  return (
    <div className="mt-3 p-3 bg-orange-500/5 rounded-lg border border-orange-500/20 space-y-3 animate-in slide-in-from-top-2 duration-200">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium flex items-center gap-1.5 text-orange-600 dark:text-orange-400">
          <Calculator className="h-3.5 w-3.5" />
          Return calculator
        </span>
        <button onClick={() => setIsExpanded(false)} className="text-xs text-muted-foreground hover:text-foreground">
          Close
        </button>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-orange-500" />
          <Input
            type="number"
            value={betAmount}
            onChange={(e) => setBetAmount(e.target.value)}
            className="pl-7 h-8 text-sm focus-visible:ring-orange-500"
            placeholder="100"
          />
        </div>
        <span className="text-xs text-muted-foreground whitespace-nowrap">total stake</span>
      </div>

      <div className="space-y-1.5">
        {betSplits.map((split, i) => (
          <div key={i} className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{split.name}</span>
            <span className="font-medium">${split.bet.toFixed(2)}</span>
          </div>
        ))}
      </div>

      <div className="pt-2 border-t border-orange-500/20 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Estimated return before fees</span>
        <span className="font-bold text-orange-500 text-sm">
          +${profit.toFixed(2)} ({arbitragePercent.toFixed(2)}%)
        </span>
      </div>
    </div>
  )
}
