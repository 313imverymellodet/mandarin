"use client"

import { AlertTriangle, X } from "lucide-react"
import { useState } from "react"

export function WarningBanner() {
  const [isVisible, setIsVisible] = useState(true)

  if (!isVisible) return null

  return (
    <div className="bg-orange-500/10 border-b border-orange-500/20 py-2 px-4 relative">
      <div className="container mx-auto flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <AlertTriangle className="h-4 w-4 text-orange-500 flex-shrink-0" />
        <span className="text-center">
          Odds move fast — always verify both lines on the venue before staking. Informational only, not financial advice.
        </span>
      </div>
      <button
        type="button"
        onClick={() => setIsVisible(false)}
        aria-label="Dismiss notice"
        className="absolute right-4 top-1/2 -translate-y-1/2 hover:text-foreground p-1 rounded-sm hover:bg-orange-500/10 transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
