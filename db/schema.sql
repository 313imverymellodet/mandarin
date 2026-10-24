-- Mandarin — Postgres schema (Railway)
-- Applied by `npm run db:migrate`, which first creates the Better Auth tables
-- ("user", session, account, verification). Safe to run more than once.
--
-- The database is only ever reached from server code with DATABASE_URL, so
-- there is no row-level security: the browser never talks to Postgres.

-- 1. Subscriptions: mirrors Stripe state. Written by the Stripe webhook.
create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references "user"(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text unique,
  price_id text,
  plan text,                              -- 'pro' | 'team'
  status text not null default 'inactive',-- Stripe subscription status
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create index if not exists subscriptions_customer_idx
  on subscriptions (stripe_customer_id);

-- 2. Odds history: a time series of the edge per market, written by the
--    server each refresh. Powers line-movement + sparklines.
create table if not exists odds_snapshots (
  id bigint generated always as identity primary key,
  opportunity_id text not null,
  league text,
  matchup text,
  edge double precision not null,
  captured_at timestamptz not null default now()
);

create index if not exists odds_snapshots_lookup
  on odds_snapshots (opportunity_id, captured_at desc);
create index if not exists odds_snapshots_time
  on odds_snapshots (captured_at);

-- 3. Edge Engine V2 shadow telemetry. Written server-side so the model can
--    later be scored on closing-line value and calibration rather than
--    short-run ROI.
--
--    Volume note: storing every evaluation would be ~500 rows/poll. We store
--    actionable signals in full, anchor fair probabilities on a throttled
--    cadence (enough to reconstruct the closing line), and rejection reasons
--    as aggregated counts — same R&D value, a fraction of the rows.

-- 3a. Actionable V2 signals: one row per (event, book, outcome, observation).
create table if not exists edge_signals (
  id bigint generated always as identity primary key,
  event_id text not null,
  league text,
  matchup text,
  commence_time timestamptz,
  observed_at timestamptz not null,
  profile text,
  devig_method text,
  market text not null default 'h2h',
  bookmaker text not null,
  outcome text not null,
  decimal_odds double precision not null,
  fair_probability double precision not null,
  probability_sigma double precision,
  conservative_fair_probability double precision,
  raw_ev double precision,
  conservative_ev double precision,
  net_ev double precision,
  confidence integer,
  anchor_source text,
  anchor_mode text,
  anchor_bookmakers text[],
  effective_book_count double precision,
  target_quote_age_seconds double precision,
  is_actionable boolean not null default true,
  rejection_reasons text[],
  -- Settlement, joined later. NULL until the event resolves.
  won boolean,
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  unique (event_id, market, bookmaker, outcome, observed_at)
);

create index if not exists edge_signals_event_idx
  on edge_signals (event_id, outcome, observed_at desc);
create index if not exists edge_signals_observed_idx
  on edge_signals (observed_at desc);
create index if not exists edge_signals_unsettled_idx
  on edge_signals (commence_time) where won is null;

-- 3b. Anchor fair probability per event/outcome over time. The last row before
--     commence_time is the closing line used for CLV.
create table if not exists market_fair_probs (
  id bigint generated always as identity primary key,
  event_id text not null,
  market text not null default 'h2h',
  outcome text not null,
  observed_at timestamptz not null,
  commence_time timestamptz,
  fair_probability double precision not null,
  anchor_mode text,
  effective_book_count double precision,
  created_at timestamptz not null default now(),
  unique (event_id, market, outcome, observed_at)
);

create index if not exists market_fair_probs_close_idx
  on market_fair_probs (event_id, outcome, observed_at desc);
create index if not exists market_fair_probs_observed_idx
  on market_fair_probs (observed_at desc);

-- 3c. Aggregated rejection reasons per scan — why edges did NOT qualify.
create table if not exists edge_rejections (
  id bigint generated always as identity primary key,
  observed_at timestamptz not null,
  sport_key text,
  reason text not null,
  count integer not null,
  created_at timestamptz not null default now(),
  unique (observed_at, sport_key, reason)
);

create index if not exists edge_rejections_observed_idx
  on edge_rejections (observed_at desc);
