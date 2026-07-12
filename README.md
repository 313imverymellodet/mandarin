# Mandarin

Live cross-book **arbitrage** across US sportsbooks. Mandarin compares every
bookmaker's price for an event and surfaces the two-sided edges where backing both
outcomes locks in a guaranteed return.

> Informational only — not financial advice. Odds move fast; always verify both lines on
> the venue before staking. Mandarin never places bets on your behalf.

## Stack

- **Next.js 16** (App Router) + React 19 + TypeScript
- **Tailwind CSS v4** + Radix UI
- **Supabase** — auth + subscription storage
- **Stripe** — Checkout + billing portal
- Market data: **The Odds API** (live US sportsbook odds; powers both the dashboard and ticker)

## How it works

| Layer | Where | Notes |
| --- | --- | --- |
| Arbitrage engine | `lib/markets/arbitrage.ts` | Pure, testable math: decimal↔implied conversion, best-price-per-outcome, edge, stake split. |
| Data sources | `lib/markets/{odds-api,kalshi,polymarket}.ts` | Each isolated; failures degrade gracefully. |
| Aggregation + cache | `lib/markets/index.ts` | Short-TTL in-process cache protects the Odds API quota. |
| API routes | `app/api/opportunities`, `app/api/markets/ticker` | JSON consumed by the client hook. |
| Live feed | `hooks/use-odds-websocket.ts` | Polls the API, diffs results to highlight new/updated rows. |
| Auth | `lib/supabase/*`, `middleware.ts`, `app/auth/*` | SSR sessions; `/arbitrage` and `/account` are protected. |
| Payments | `lib/stripe.ts`, `app/api/stripe/*` | Checkout → webhook → subscription row in Supabase. |

Every integration is **optional**. With no keys the app still builds and runs; each
feature activates when its keys are present (see `lib/config.ts`).

## Setup

```bash
npm install
cp .env.example .env.local   # then fill in keys
npm run dev
```

### 1. Market data (The Odds API)
1. Get a key at <https://the-odds-api.com> (free tier works for testing).
2. Set `ODDS_API_KEY`. Tune `ODDS_API_SPORTS` / `ODDS_API_REGIONS` to control quota use.
3. Both the dashboard and the live ticker are served from this one cached source.

### 2. Auth (Supabase)
1. Create a project at <https://supabase.com>.
2. Run `supabase/schema.sql` in the SQL editor (creates `profiles`, `subscriptions`, RLS, and the new-user trigger).
3. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
4. In Auth → URL Configuration, add `${SITE_URL}/auth/callback` as a redirect URL. For Google/GitHub, enable those providers.

### 3. Payments (Stripe)
1. Create two recurring Products (Pro, Team); copy their Price IDs into `STRIPE_PRICE_PRO` / `STRIPE_PRICE_TEAM`.
2. Set `STRIPE_SECRET_KEY` and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
3. Local webhook: `stripe listen --forward-to localhost:3000/api/stripe/webhook`, copy the signing secret into `STRIPE_WEBHOOK_SECRET`.
4. Production: add a webhook endpoint for `checkout.session.completed` and `customer.subscription.*`, and use that endpoint's signing secret.

## Scripts

```bash
npm run dev     # local dev
npm run build   # production build
npm run start   # serve the build
npm run lint    # eslint
```

## Deploying

Deploys cleanly to Vercel. Add every variable from `.env.example` in Project Settings →
Environment Variables, set `NEXT_PUBLIC_SITE_URL` to your production URL, and register the
Stripe webhook against `https://<your-domain>/api/stripe/webhook`.

## Responsible use

Arbitrage betting may be restricted by your jurisdiction and by each venue's terms;
accounts can be limited or closed. This project is provided for informational and
educational purposes only.
