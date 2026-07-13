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

-- 4. Auto-create a profile row when a new auth user signs up.
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
