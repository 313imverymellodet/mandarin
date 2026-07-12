"use client"

import { ExternalLink, Layers, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useState } from "react"

interface Platform {
  name: string
  url: string
  odds: number
}

interface QuickActionButtonProps {
  platforms: Platform[]
}

export function QuickActionButton({ platforms }: QuickActionButtonProps) {
  const [clicked, setClicked] = useState(false)
  const label = platforms.length === 2 ? "Open Both" : `Open All ${platforms.length}`

  const openBothPlatforms = () => {
    platforms.forEach((platform) => {
      window.open(platform.url, "_blank", "noopener,noreferrer")
    })

    setClicked(true)
    setTimeout(() => setClicked(false), 2000)
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            aria-label={`${label} — ${platforms.map((p) => p.name).join(", ")}`}
            className="gap-1.5 h-8 text-xs bg-transparent hover:bg-orange-500/10 hover:border-orange-500/50 hover:text-orange-500 transition-colors"
            onClick={openBothPlatforms}
          >
            {clicked ? (
              <>
                <Check className="h-3.5 w-3.5 text-orange-500" aria-hidden="true" />
                <span className="hidden sm:inline text-orange-500">Opened!</span>
              </>
            ) : (
              <>
                <Layers className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">{label}</span>
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Open {platforms.length === 2 ? "both books" : `all ${platforms.length} books`} side-by-side</p>
          <p className="text-xs text-muted-foreground">{platforms.map((p) => p.name).join(" & ")}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
