create extension if not exists pgcrypto with schema extensions;

alter table public.subscriptions
  add column if not exists cancel_at_period_end boolean not null default false;

create table if not exists public.billing_trial_claims (
  identity_type text not null check (identity_type in ('email', 'phone')),
  identity_hash text not null,
  first_user_id uuid references auth.users (id) on delete set null,
  stripe_customer_id text,
  claimed_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (identity_type, identity_hash)
);

create index if not exists billing_trial_claims_first_user_idx
on public.billing_trial_claims (first_user_id);

alter table public.billing_trial_claims enable row level security;

revoke all on public.billing_trial_claims from anon;
revoke all on public.billing_trial_claims from authenticated;
grant select, insert, update on public.billing_trial_claims to service_role;

insert into public.billing_trial_claims (
  identity_type,
  identity_hash,
  first_user_id,
  stripe_customer_id,
  claimed_at,
  last_seen_at
)
select
  'email',
  encode(extensions.digest(lower(trim(users.email)), 'sha256'), 'hex'),
  subscriptions.user_id,
  subscriptions.stripe_customer_id,
  coalesce(subscriptions.trial_start, subscriptions.trial_end, subscriptions.updated_at, now()),
  now()
from public.subscriptions
join auth.users on users.id = subscriptions.user_id
where (subscriptions.trial_start is not null or subscriptions.trial_end is not null)
  and users.email is not null
  and length(trim(users.email)) > 0
on conflict (identity_type, identity_hash) do update
set
  last_seen_at = excluded.last_seen_at,
  stripe_customer_id = coalesce(
    public.billing_trial_claims.stripe_customer_id,
    excluded.stripe_customer_id
  );

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'auth'
      and table_name = 'users'
      and column_name = 'phone'
  ) then
    execute $sql$
      insert into public.billing_trial_claims (
        identity_type,
        identity_hash,
        first_user_id,
        stripe_customer_id,
        claimed_at,
        last_seen_at
      )
      select
        'phone',
        encode(extensions.digest(regexp_replace(users.phone, '[^0-9]', '', 'g'), 'sha256'), 'hex'),
        subscriptions.user_id,
        subscriptions.stripe_customer_id,
        coalesce(subscriptions.trial_start, subscriptions.trial_end, subscriptions.updated_at, now()),
        now()
      from public.subscriptions
      join auth.users on users.id = subscriptions.user_id
      where (subscriptions.trial_start is not null or subscriptions.trial_end is not null)
        and users.phone is not null
        and length(regexp_replace(users.phone, '[^0-9]', '', 'g')) >= 10
      on conflict (identity_type, identity_hash) do update
      set
        last_seen_at = excluded.last_seen_at,
        stripe_customer_id = coalesce(
          public.billing_trial_claims.stripe_customer_id,
          excluded.stripe_customer_id
        )
    $sql$;
  end if;
end $$;
