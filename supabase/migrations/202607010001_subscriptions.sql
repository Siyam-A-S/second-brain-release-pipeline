create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  status text,
  trial_start timestamptz,
  trial_end timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

drop policy if exists "Users can read their own subscription" on public.subscriptions;

create policy "Users can read their own subscription"
on public.subscriptions
for select
to authenticated
using (auth.uid() = user_id);

create table if not exists public.desktop_log_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  request_id text not null,
  event_name text not null,
  level text not null default 'info',
  message text,
  metadata jsonb not null default '{}'::jsonb,
  app_version text,
  build_channel text,
  device_id text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists desktop_log_events_user_created_idx
on public.desktop_log_events (user_id, created_at desc);

create index if not exists desktop_log_events_request_id_idx
on public.desktop_log_events (request_id);

alter table public.desktop_log_events enable row level security;

drop policy if exists "Users can insert their own desktop logs" on public.desktop_log_events;
drop policy if exists "Users can read their own desktop logs" on public.desktop_log_events;

create policy "Users can insert their own desktop logs"
on public.desktop_log_events
for insert
to authenticated
with check (auth.uid() = user_id);
