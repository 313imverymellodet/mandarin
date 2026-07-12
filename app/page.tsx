import { Header } from "@/components/header"
import { WarningBanner } from "@/components/warning-banner"
import { MarketTicker } from "@/components/market-ticker"
import { HeroSection } from "@/components/hero-section"
import { ArbitrageCards } from "@/components/arbitrage-cards"
import { HowItWorks } from "@/components/how-it-works"

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <WarningBanner />
      <Header />
      <MarketTicker />
      <main>
        <div className="container mx-auto grid items-start gap-8 px-4 py-8 sm:py-12 lg:grid-cols-2 lg:gap-12 lg:py-16">
          <HeroSection />
          <ArbitrageCards showStats={false} limit={3} />
        </div>
        <HowItWorks />
      </main>
    </div>
  )
}
