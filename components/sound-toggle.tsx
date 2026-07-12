"use client"

import { Volume2, VolumeX } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface SoundToggleProps {
  enabled: boolean
  onToggle: (enabled: boolean) => void
}

export function SoundToggle({ enabled, onToggle }: SoundToggleProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onToggle(!enabled)}
            aria-label={enabled ? "Disable sound alerts" : "Enable sound alerts"}
            aria-pressed={enabled}
            className={`h-8 w-8 p-0 ${enabled ? "text-orange-500" : "text-muted-foreground"} hover:text-orange-500 hover:bg-orange-500/10`}
          >
            {enabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{enabled ? "Sound alerts on" : "Sound alerts off"}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
