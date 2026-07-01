create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  status text,
  trial_start timestamptz,
  trial_end timestamptz
);

alter table public.subscriptions enable row level security;

drop policy if exists "Users can read their own subscription" on public.subscriptions;

create policy "Users can read their own subscription"
on public.subscriptions
for select
to authenticated
using (auth.uid() = user_id);
