/**
 * Central runtime configuration. Every external integration is optional:
 * if its keys are absent the corresponding feature is disabled gracefully
 * instead of crashing the app. This keeps the MVP deployable at any stage
 * of setup.
 */

function env(name: string): string | undefined {
  const value = process.env[name]
  return value && value.trim().length > 0 ? value.trim() : undefined
}

export const config = {
  oddsApi: {
    key: env("ODDS_API_KEY"),
    baseUrl: env("ODDS_API_BASE_URL") ?? "https://api.the-odds-api.com/v4",
    // Which sports to poll. Odds API charges per sport per refresh, so keep this
    // tight and in-season. Override seasonally with ODDS_API_SPORTS. The default
    // targets sports with games mid-year; off-season sports just return nothing.
    sports: (env("ODDS_API_SPORTS") ?? "baseball_mlb,soccer_usa_mls,mma_mixed_martial_arts,basketball_wnba")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    regions: env("ODDS_API_REGIONS") ?? "us",
    // Only consider these bookmakers. For real-money use set this to the books
    // YOU actually hold accounts with and can bet at in your state — that's what
    // makes an arb actionable. Default excludes offshore books whose lines are
    // often stale and unbettable (betonlineag, mybookieag, bovada, lowvig, betus).
    books: (env("ODDS_API_BOOKS") ??
      "draftkings,fanduel,betmgm,caesars,williamhill_us,betrivers,espnbet,fanatics,hardrockbet,ballybet,fliff")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
    // Drop any book quote older than this — a stale price is a phantom arb.
    maxQuoteAgeMs: Number(env("ODDS_API_MAX_QUOTE_AGE_MS") ?? 8 * 60_000),
    // Edges above this are almost always a stale/erroneous line, not money.
    // They're kept but flagged "suspect" so you verify before trusting them.
    maxBelievableEdge: Number(env("ODDS_API_MAX_EDGE") ?? 4.5),
    // Sharp book(s) used ONLY to anchor de-vigged fair value for +EV detection.
    // Pinnacle is not an actionable US bet target — it never appears in `books`.
    sharpBooks: (env("ODDS_API_SHARP_BOOKS") ?? "pinnacle")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
    // Positive-EV engine defaults (see lib/markets/edge.ts). Server is the source
    // of truth for which opportunities qualify.
    edge: {
      minimumEv: Number(env("ODDS_API_MIN_EV") ?? 0.015), // 1.5%
      kellyFraction: Number(env("ODDS_API_KELLY_FRACTION") ?? 0.25), // quarter Kelly
      minConsensusBooks: Number(env("ODDS_API_MIN_CONSENSUS_BOOKS") ?? 3),
      targetBookCount: Number(env("ODDS_API_TARGET_BOOKS") ?? 6),
      agreementStdevCeiling: Number(env("ODDS_API_AGREEMENT_STDEV") ?? 0.08),
    },
    get enabled() {
      return Boolean(this.key)
    },
    /**
     * Books sent to the Odds API `bookmakers` param: sharp anchor(s) + eligible
     * US books, capped at 10 so each request stays a single quota unit.
     */
    get requestBookmakers(): string[] {
      return [...new Set([...this.sharpBooks, ...this.books])].slice(0, 10)
    },
  },
  supabase: {
    url: env("NEXT_PUBLIC_SUPABASE_URL"),
    anonKey: env("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    serviceRoleKey: env("SUPABASE_SERVICE_ROLE_KEY"),
    get enabled() {
      return Boolean(this.url && this.anonKey)
    },
  },
  stripe: {
    secretKey: env("STRIPE_SECRET_KEY"),
    webhookSecret: env("STRIPE_WEBHOOK_SECRET"),
    publishableKey: env("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"),
    prices: {
      pro: env("STRIPE_PRICE_PRO"),
      team: env("STRIPE_PRICE_TEAM"),
    },
    get enabled() {
      return Boolean(this.secretKey)
    },
  },
  site: {
    url: env("NEXT_PUBLIC_SITE_URL") ?? "http://localhost:3000",
  },
  // How long the server caches aggregated opportunities before refetching
  // upstream APIs. Protects the Odds API quota (free tier is ~500 req/mo).
  cacheTtlMs: Number(env("MARKET_CACHE_TTL_MS") ?? 60_000),
} as const

export type AppConfig = typeof config
