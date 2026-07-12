"use client"

import { Wifi, WifiOff } from "lucide-react"
import { useState, useEffect } from "react"

interface ConnectionStatusProps {
  isConnected: boolean
  lastUpdate: Date
}

export function ConnectionStatus({ isConnected, lastUpdate }: ConnectionStatusProps) {
  const [mounted, setMounted] = useState(false)
  const [, setTick] = useState(0)

  useEffect(() => {
    setMounted(true)
    const interval = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(interval)
  }, [])

  if (!mounted) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Wifi className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="hidden sm:inline">Connecting...</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      {isConnected ? (
        <>
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-500 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-orange-500" />
          </span>
          <span className="hidden sm:inline text-orange-500 font-medium">Live</span>
          <span className="text-muted-foreground/70">Updated {formatTimeAgo(lastUpdate)}</span>
        </>
      ) : (
        <>
          <WifiOff className="h-3.5 w-3.5 text-red-500" />
          <span>Connecting...</span>
        </>
      )}
    </div>
  )
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 5) return "just now"
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  return `${minutes}m ago`
}
