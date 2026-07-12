import { Header } from "@/components/header"
import { WarningBanner } from "@/components/warning-banner"
import { MarketTicker } from "@/components/market-ticker"
import { HeroSection } from "@/components/hero-section"
import { ArbitrageCards } from "@/components/arbitrage-cards"

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <WarningBanner />
      <Header />
      <MarketTicker />
      <main className="container mx-auto px-4 py-8 sm:py-12 lg:py-16">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-start">
          <HeroSection />
          <ArbitrageCards showStats={false} limit={3} />
        </div>
      </main>
    </div>
  )
}
