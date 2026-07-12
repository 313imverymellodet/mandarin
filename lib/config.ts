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
    // Which sports to poll. Odds API charges per market/region, so keep this tight.
    sports: (env("ODDS_API_SPORTS") ??
      "americanfootball_nfl,basketball_nba,icehockey_nhl,americanfootball_ncaaf,mma_mixed_martial_arts,soccer_epl")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    regions: env("ODDS_API_REGIONS") ?? "us",
    get enabled() {
      return Boolean(this.key)
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
