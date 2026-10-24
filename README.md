# Mandarin

Live cross-book **arbitrage** across US sportsbooks. Mandarin compares every
bookmaker's price for an event and surfaces the two-sided edges where backing both
outcomes locks in a guaranteed return.

> Informational only — not financial advice. Odds move fast; always verify both lines on
> the venue before staking. Mandarin never places bets on your behalf.

## Stack

- **Next.js 16** (App Router) + React 19 + TypeScript
- **Tailwind CSS v4** + Radix UI
- **Railway Postgres** — accounts, subscriptions, odds history and engine telemetry
- **Better Auth** — email/password sign-in (optional Google/GitHub), sessions stored in Postgres
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
| Database | `lib/db.ts`, `db/schema.sql`, `scripts/db-migrate.ts` | One server-only `pg` pool; `npm run db:migrate` creates every table. |
| Auth | `lib/auth.ts`, `lib/session.ts`, `proxy.ts`, `app/auth/*`, `app/api/auth/[...all]` | Better Auth sessions; `/arbitrage` and `/account` are protected. |
| Payments | `lib/stripe.ts`, `app/api/stripe/*` | Checkout → webhook → subscription row in Postgres. |

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

### 2. Database + auth (Railway)
1. On <https://railway.com>, create a project and add a **PostgreSQL** service.
2. Copy its connection string into `DATABASE_URL` — use `DATABASE_PUBLIC_URL` when the app runs outside Railway (e.g. Vercel).
3. Set `BETTER_AUTH_SECRET` to a long random string (`openssl rand -base64 32`).
4. Run `npm run db:migrate` once (safe to re-run) — creates the auth tables (`user`, `session`, `account`, `verification`) and the app tables.
5. Optional: `RESEND_API_KEY` for password-reset emails (otherwise the reset link is logged server-side), and Google/GitHub client IDs for social sign-in — callback URL is `${SITE_URL}/api/auth/callback/<provider>`.

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
