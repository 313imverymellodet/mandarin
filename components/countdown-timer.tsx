"use client"

import { useState, useEffect } from "react"
import { Clock } from "lucide-react"

interface CountdownTimerProps {
  eventTime: Date
  compact?: boolean
}

export function CountdownTimer({ eventTime, compact = false }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState(() => calculateTimeLeft(eventTime))
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft(eventTime))
    }, 1000)

    return () => clearInterval(timer)
  }, [eventTime])

  if (!mounted) {
    if (compact) {
      return <span className="text-xs font-mono text-muted-foreground">--:--</span>
    }
    return (
      <div className="flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-md bg-muted text-muted-foreground">
        <Clock className="h-3 w-3" />
        <span className="font-mono">--:--</span>
      </div>
    )
  }

  const isUrgent = timeLeft.total < 30 * 60 * 1000 // Less than 30 minutes
  const isWarning = timeLeft.total < 60 * 60 * 1000 // Less than 1 hour

  if (compact) {
    return (
      <span
        className={`text-xs font-mono ${
          isUrgent ? "text-red-500" : isWarning ? "text-amber-500" : "text-muted-foreground"
        }`}
      >
        {timeLeft.hours > 0 && `${timeLeft.hours}h `}
        {timeLeft.minutes}m {timeLeft.seconds}s
      </span>
    )
  }

  return (
    <div
      className={`flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-md ${
        isUrgent
          ? "bg-red-500/10 text-red-500"
          : isWarning
            ? "bg-amber-500/10 text-amber-500"
            : "bg-muted text-muted-foreground"
      }`}
    >
      <Clock className="h-3 w-3" />
      <span className="font-mono">
        {timeLeft.hours > 0 && `${timeLeft.hours}:`}
        {String(timeLeft.minutes).padStart(2, "0")}:{String(timeLeft.seconds).padStart(2, "0")}
      </span>
    </div>
  )
}

function calculateTimeLeft(eventTime: Date) {
  const difference = new Date(eventTime).getTime() - Date.now()

  if (difference <= 0) {
    return { hours: 0, minutes: 0, seconds: 0, total: 0 }
  }

  return {
    hours: Math.floor(difference / (1000 * 60 * 60)),
    minutes: Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60)),
    seconds: Math.floor((difference % (1000 * 60)) / 1000),
    total: difference,
  }
}
