"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { MandarinLogo } from "@/components/mandarin-logo"
import { ArbitrageCards } from "@/components/arbitrage-cards"
import { MarketTicker } from "@/components/market-ticker"
import { ArrowLeft, User } from "lucide-react"

export default function ArbitragePage() {
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
          <Link href="/account">
            <Button variant="ghost" size="icon" aria-label="Open account page">
              <User className="h-4 w-4" aria-hidden="true" />
            </Button>
          </Link>
        </div>
      </header>

      {/* Market Ticker */}
      <MarketTicker />

      <main className="container mx-auto px-4 py-6">
        {/* Page header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Arbitrage Opportunities</h1>
            <p className="text-muted-foreground text-sm">Live cross-book arbitrage across US sportsbooks</p>
          </div>
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Home
            </Button>
          </Link>
        </div>

        <ArbitrageCards showFilters />
      </main>
    </div>
  )
}
