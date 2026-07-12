"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MandarinLogo } from "@/components/mandarin-logo"
import { ArrowLeft, Play, Pause, RotateCcw, TrendingUp, Zap, DollarSign, Clock } from "lucide-react"

export default function DemoPage() {
  const [isPlaying, setIsPlaying] = useState(true)
  const [currentStep, setCurrentStep] = useState(0)
  const [profit, setProfit] = useState(0)

  const steps = [
    { title: "Scanning markets...", description: "Checking 50+ platforms for price discrepancies" },
    { title: "Opportunity found!", description: "Eagles @ Chargers - Kalshi vs Polymarket" },
    { title: "Calculating arbitrage...", description: "Analyzing odds for guaranteed profit" },
    { title: "Profit locked in!", description: "+3.50% return on $100 stake = $3.50 profit" },
  ]

  useEffect(() => {
    if (!isPlaying) return

    const interval = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev < steps.length - 1) {
          if (prev === 2) setProfit(3.5)
          return prev + 1
        }
        return prev
      })
    }, 2000)

    return () => clearInterval(interval)
  }, [isPlaying, steps.length])

  const resetDemo = () => {
    setCurrentStep(0)
    setProfit(0)
    setIsPlaying(true)
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <MandarinLogo className="w-8 h-8" />
            <span className="font-semibold text-xl">Mandarin</span>
          </Link>
          <Link href="/">
            <Button variant="ghost" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to home
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          {/* Hero */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-orange-500/10 rounded-full border border-orange-500/20 mb-4">
              <Play className="h-3.5 w-3.5 text-orange-500" />
              <span className="text-orange-600 dark:text-orange-400 text-sm font-medium">Interactive Demo</span>
            </div>
            <h1 className="text-4xl font-bold mb-4">
              See{" "}
              <span className="bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent">
                Mandarin
              </span>{" "}
              in action
            </h1>
            <p className="text-muted-foreground text-lg">Watch how we detect arbitrage opportunities in real-time</p>
          </div>

          {/* Demo visualization */}
          <Card className="mb-8 overflow-hidden">
            <CardHeader className="bg-muted/50 border-b border-border">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Live Arbitrage Scanner</CardTitle>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setIsPlaying(!isPlaying)} className="gap-2">
                    {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                    {isPlaying ? "Pause" : "Play"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={resetDemo} className="gap-2 bg-transparent">
                    <RotateCcw className="h-3.5 w-3.5" />
                    Reset
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-8">
              {/* Progress steps */}
              <div className="space-y-6 mb-8">
                {steps.map((step, index) => (
                  <div
                    key={index}
                    className={`flex items-start gap-4 transition-all duration-500 ${
                      index <= currentStep ? "opacity-100" : "opacity-30"
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                        index < currentStep
                          ? "bg-orange-500 text-white"
                          : index === currentStep
                            ? "bg-orange-500/20 text-orange-500 animate-pulse"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {index < currentStep ? "✓" : index + 1}
                    </div>
                    <div>
                      <p className="font-medium">{step.title}</p>
                      <p className="text-sm text-muted-foreground">{step.description}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Result card */}
              {currentStep === steps.length - 1 && (
                <div className="bg-gradient-to-br from-orange-500/10 to-amber-500/10 rounded-xl p-6 border border-orange-500/20 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-orange-500/20 rounded-lg">
                        <TrendingUp className="h-5 w-5 text-orange-500" />
                      </div>
                      <div>
                        <p className="font-semibold">Philadelphia Eagles @ Los Angeles Chargers</p>
                        <p className="text-sm text-muted-foreground">NFL - Kalshi vs Polymarket</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-orange-500">+{profit.toFixed(2)}%</p>
                      <p className="text-sm text-muted-foreground">Guaranteed return</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-background rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 bg-green-500 rounded flex items-center justify-center text-white text-xs font-bold">
                          K
                        </div>
                        <span className="font-medium">Kalshi</span>
                      </div>
                      <p className="text-2xl font-bold">44%</p>
                      <p className="text-sm text-muted-foreground">Bet $56 on No</p>
                    </div>
                    <div className="bg-background rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 bg-blue-500 rounded flex items-center justify-center text-white text-xs font-bold">
                          P
                        </div>
                        <span className="font-medium">Polymarket</span>
                      </div>
                      <p className="text-2xl font-bold">52.5%</p>
                      <p className="text-sm text-muted-foreground">Bet $44 on Yes</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Stats */}
          <div className="grid sm:grid-cols-3 gap-6 mb-12">
            <Card>
              <CardContent className="p-6 text-center">
                <Zap className="h-8 w-8 text-orange-500 mx-auto mb-2" />
                <p className="text-3xl font-bold">1.5s</p>
                <p className="text-sm text-muted-foreground">Update speed</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6 text-center">
                <DollarSign className="h-8 w-8 text-orange-500 mx-auto mb-2" />
                <p className="text-3xl font-bold">3.2%</p>
                <p className="text-sm text-muted-foreground">Avg return</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6 text-center">
                <Clock className="h-8 w-8 text-orange-500 mx-auto mb-2" />
                <p className="text-3xl font-bold">24/7</p>
                <p className="text-sm text-muted-foreground">Monitoring</p>
              </CardContent>
            </Card>
          </div>

          {/* CTA */}
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">Ready to start finding arbitrage?</h2>
            <div className="flex flex-wrap justify-center gap-4">
              <Link href="/sign-in">
                <Button className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-6 text-lg gap-2">
                  Get Started Free
                  <Zap className="h-5 w-5" />
                </Button>
              </Link>
              <Link href="/pricing">
                <Button variant="outline" className="px-8 py-6 text-lg bg-transparent">
                  View Pricing
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
