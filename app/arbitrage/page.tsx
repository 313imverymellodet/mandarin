"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { MandarinLogo } from "@/components/mandarin-logo"
import { ArbitrageCards } from "@/components/arbitrage-cards"
import { MarketTicker } from "@/components/market-ticker"
import { SoundToggle } from "@/components/sound-toggle"
import { ArrowLeft, Settings, Bell, User, Filter, SortDesc } from "lucide-react"
import { useState } from "react"

export default function ArbitragePage() {
  const [soundEnabled, setSoundEnabled] = useState(false)
  const [filter, setFilter] = useState("all")

  const filters = [
    { id: "all", label: "All" },
    { id: "nfl", label: "NFL" },
    { id: "nba", label: "NBA" },
    { id: "cfb", label: "CFB" },
    { id: "nhl", label: "NHL" },
    { id: "ufc", label: "UFC" },
    { id: "soccer", label: "Soccer" },
    { id: "politics", label: "Politics" },
  ]

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border sticky top-0 z-50 bg-background">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2">
              <MandarinLogo className="w-8 h-8" />
              <span className="font-semibold text-lg">Mandarin</span>
            </Link>
            <div className="hidden sm:flex items-center gap-1 px-2 py-1 bg-orange-500/10 rounded-full">
              <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
              <span className="text-xs text-orange-600 dark:text-orange-400 font-medium">Live odds</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <SoundToggle enabled={soundEnabled} onToggle={() => setSoundEnabled(!soundEnabled)} />
            <Button variant="ghost" size="icon" className="hidden sm:flex" aria-label="Notifications">
              <Bell className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="hidden sm:flex" aria-label="Settings">
              <Settings className="h-4 w-4" />
            </Button>
            <Link href="/account">
              <Button variant="ghost" size="icon" aria-label="Open account page">
                <User className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>

        <div className="border-t border-border">
          <div className="container mx-auto px-4 py-2">
            <div className="flex items-center justify-between gap-4 overflow-x-auto">
              <div className="flex items-center gap-2 flex-nowrap">
                {filters.map((f) => (
                  <Button
                    key={f.id}
                    variant={filter === f.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFilter(f.id)}
                    className={`flex-shrink-0 ${
                      filter === f.id ? "bg-orange-500 hover:bg-orange-600 text-white" : "bg-transparent"
                    }`}
                  >
                    {f.label}
                  </Button>
                ))}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button variant="outline" size="sm" className="gap-2 bg-transparent">
                  <Filter className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Filters</span>
                </Button>
                <Button variant="outline" size="sm" className="gap-2 bg-transparent">
                  <SortDesc className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Sort by Profit</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Market Ticker */}
      <MarketTicker />

      <main className="container mx-auto px-4 py-6">
        {/* Page header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Arbitrage Opportunities</h1>
            <p className="text-muted-foreground text-sm">
              Live cross-book arbitrage across US sportsbooks
              {filter !== "all" && (
                <span className="ml-2 text-orange-500">• Filtered: {filters.find((f) => f.id === filter)?.label}</span>
              )}
            </p>
          </div>
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Home
            </Button>
          </Link>
        </div>

        <ArbitrageCards filter={filter} />
      </main>
    </div>
  )
}
