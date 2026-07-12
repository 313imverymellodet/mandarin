"use client"
import { Shield, ShieldAlert, ShieldCheck } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface RiskIndicatorProps {
  level: "low" | "medium" | "high"
  showLabel?: boolean
}

const riskConfig = {
  low: {
    icon: ShieldCheck,
    color: "text-green-500",
    bgColor: "bg-green-500/10",
    label: "Low Risk",
    description: "Stable odds, low volatility",
  },
  medium: {
    icon: Shield,
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
    label: "Medium Risk",
    description: "Moderate odds movement",
  },
  high: {
    icon: ShieldAlert,
    color: "text-red-500",
    bgColor: "bg-red-500/10",
    label: "High Risk",
    description: "Volatile odds, act quickly",
  },
}

export function RiskIndicator({ level, showLabel = false }: RiskIndicatorProps) {
  const config = riskConfig[level]
  const Icon = config.icon

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md ${config.bgColor}`}>
            <Icon className={`h-3.5 w-3.5 ${config.color}`} />
            {showLabel && <span className={`text-xs font-medium ${config.color}`}>{config.label}</span>}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p className="font-medium">{config.label}</p>
          <p className="text-xs text-muted-foreground">{config.description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
