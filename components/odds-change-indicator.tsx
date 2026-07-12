"use client"

import { TrendingUp, TrendingDown } from "lucide-react"
import { useEffect, useState } from "react"

interface OddsChangeIndicatorProps {
  currentOdds: number
  previousOdds?: number
}

export function OddsChangeIndicator({ currentOdds, previousOdds }: OddsChangeIndicatorProps) {
  const [showChange, setShowChange] = useState(false)
  const [flash, setFlash] = useState(false)

  useEffect(() => {
    if (previousOdds && previousOdds !== currentOdds) {
      setShowChange(true)
      setFlash(true)

      // Remove flash after animation
      const flashTimer = setTimeout(() => setFlash(false), 1000)

      // Hide indicator after 5 seconds
      const hideTimer = setTimeout(() => setShowChange(false), 5000)

      return () => {
        clearTimeout(flashTimer)
        clearTimeout(hideTimer)
      }
    }
  }, [currentOdds, previousOdds])

  if (!showChange || !previousOdds || previousOdds === currentOdds) {
    return null
  }

  const change = currentOdds - previousOdds
  const isUp = change > 0

  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs ml-1 px-1 py-0.5 rounded ${
        isUp ? "text-green-600 bg-green-100 dark:bg-green-900/30" : "text-red-600 bg-red-100 dark:bg-red-900/30"
      } ${flash ? "animate-pulse" : ""}`}
    >
      {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      <span className="font-medium">
        {isUp ? "+" : ""}
        {change.toFixed(1)}
      </span>
    </span>
  )
}
