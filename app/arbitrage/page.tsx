"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { MandarinLogo } from "@/components/mandarin-logo"
import { ArbitrageCards } from "@/components/arbitrage-cards"
import { MarketScanner } from "@/components/market-scanner"
import { MarketTicker } from "@/components/market-ticker"
import { ArrowLeft, User, LayoutGrid, Table2, HelpCircle } from "lucide-react"

type View = "scanner" | "cards"

export default function ArbitragePage() {
  const [view, setView] = useState<View>("scanner")

  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get("view")
    if (param === "cards" || param === "scanner") setView(param)
  }, [])

  const selectView = (next: View) => {
    setView(next)
    const url = new URL(window.location.href)
    if (next === "scanner") url.searchParams.delete("view")
    else url.searchParams.set("view", next)
    window.history.replaceState(null, "", url)
  }

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
              <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" aria-hidden="true" />
              <span className="text-xs text-orange-600 dark:text-orange-400 font-medium">Live odds</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Link href="/how-it-works">
              <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground">
                <HelpCircle className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">How it works</span>
              </Button>
            </Link>
            <Link href="/account">
              <Button variant="ghost" size="icon" aria-label="Open account page">
                <User className="h-4 w-4" aria-hidden="true" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Market Ticker */}
      <MarketTicker />

      <main className="container mx-auto px-4 py-6">
        {/* Page header */}
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold">Arbitrage Scanner</h1>
            <p className="truncate text-sm text-muted-foreground">Live cross-book odds across US sportsbooks</p>
          </div>
          <div className="flex flex-shrink-0 items-center gap-3">
            {/* View toggle */}
            <div className="flex items-center gap-0.5 rounded-lg border border-border bg-card p-0.5" role="group" aria-label="View mode">
              <button
                onClick={() => selectView("scanner")}
                aria-pressed={view === "scanner"}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  view === "scanner" ? "bg-orange-500 text-white" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Table2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">Scanner</span>
              </button>
              <button
                onClick={() => selectView("cards")}
                aria-pressed={view === "cards"}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  view === "cards" ? "bg-orange-500 text-white" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">Cards</span>
              </button>
            </div>
            <Link href="/" className="hidden sm:block">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Home
              </Button>
            </Link>
          </div>
        </div>

        {view === "scanner" ? <MarketScanner /> : <ArbitrageCards showFilters />}
      </main>
    </div>
  )
}
