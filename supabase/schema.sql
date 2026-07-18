-- Mandarin — Supabase schema
-- Run this in the Supabase SQL editor (Dashboard → SQL → New query).
-- Safe to run more than once.

-- 1. Profiles: one row per auth user, auto-created on sign up.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Profiles are viewable by owner" on public.profiles;
create policy "Profiles are viewable by owner"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Profiles are updatable by owner" on public.profiles;
create policy "Profiles are updatable by owner"
  on public.profiles for update
  using (auth.uid() = id);

-- 2. Subscriptions: mirrors Stripe state. Written by the webhook using the
--    service role (which bypasses RLS); read-only to the owning user.
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
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

alter table public.subscriptions enable row level security;

drop policy if exists "Subscriptions are viewable by owner" on public.subscriptions;
create policy "Subscriptions are viewable by owner"
  on public.subscriptions for select
  using (auth.uid() = user_id);

create index if not exists subscriptions_customer_idx
  on public.subscriptions (stripe_customer_id);

-- 3. Odds history: a time series of the edge per market, written by the
--    server (service role) each refresh. Powers line-movement + sparklines.
--    Not user data — RLS on with no policies denies client access; the
--    service role bypasses RLS.
create table if not exists public.odds_snapshots (
  id bigint generated always as identity primary key,
  opportunity_id text not null,
  league text,
  matchup text,
  edge double precision not null,
  captured_at timestamptz not null default now()
);

create index if not exists odds_snapshots_lookup
  on public.odds_snapshots (opportunity_id, captured_at desc);
create index if not exists odds_snapshots_time
  on public.odds_snapshots (captured_at);

alter table public.odds_snapshots enable row level security;

-- 4. Edge Engine V2 shadow telemetry. Written server-side (service role) so the
--    model can later be scored on closing-line value and calibration rather
--    than short-run ROI. RLS on with no policies = clients cannot read it.
--
--    Volume note: storing every evaluation would be ~500 rows/poll. We store
--    actionable signals in full, anchor fair probabilities on a throttled
--    cadence (enough to reconstruct the closing line), and rejection reasons
--    as aggregated counts — same R&D value, a fraction of the rows.

-- 4a. Actionable V2 signals: one row per (event, book, outcome, observation).
create table if not exists public.edge_signals (
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
  on public.edge_signals (event_id, outcome, observed_at desc);
create index if not exists edge_signals_observed_idx
  on public.edge_signals (observed_at desc);
create index if not exists edge_signals_unsettled_idx
  on public.edge_signals (commence_time) where won is null;

alter table public.edge_signals enable row level security;

-- 4b. Anchor fair probability per event/outcome over time. The last row before
--     commence_time is the closing line used for CLV.
create table if not exists public.market_fair_probs (
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
  on public.market_fair_probs (event_id, outcome, observed_at desc);
create index if not exists market_fair_probs_observed_idx
  on public.market_fair_probs (observed_at desc);

alter table public.market_fair_probs enable row level security;

-- 4c. Aggregated rejection reasons per scan — why edges did NOT qualify.
create table if not exists public.edge_rejections (
  id bigint generated always as identity primary key,
  observed_at timestamptz not null,
  sport_key text,
  reason text not null,
  count integer not null,
  created_at timestamptz not null default now(),
  unique (observed_at, sport_key, reason)
);

create index if not exists edge_rejections_observed_idx
  on public.edge_rejections (observed_at desc);

alter table public.edge_rejections enable row level security;

-- 5. Auto-create a profile row when a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
