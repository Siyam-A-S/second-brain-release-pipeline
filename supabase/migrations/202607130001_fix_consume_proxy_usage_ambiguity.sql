create or replace function public.consume_proxy_usage(
  p_user_id uuid,
  p_increment integer default 1
)
returns table (
  allowed boolean,
  reason text,
  plan_name text,
  used integer,
  "limit" integer,
  reset_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bucket_date date := (now() at time zone 'utc')::date;
  v_reset_at timestamptz := ((now() at time zone 'utc')::date + interval '1 day') at time zone 'utc';
  v_free_limit integer;
  v_pro_limit integer;
  v_plan_name text := 'Second Brain Free';
  v_request_limit integer;
  v_usage public.account_usage_daily%rowtype;
  v_user_exists boolean;
begin
  if p_increment is null or p_increment < 1 then
    p_increment := 1;
  end if;

  select exists(select 1 from auth.users where id = p_user_id)
  into v_user_exists;

  select value
  into v_free_limit
  from public.account_entitlement_settings
  where key = 'free_daily_request_limit';

  select value
  into v_pro_limit
  from public.account_entitlement_settings
  where key = 'pro_daily_request_limit';

  v_free_limit := coalesce(v_free_limit, 250);
  v_pro_limit := coalesce(v_pro_limit, 1000);
  v_request_limit := v_free_limit;

  if not coalesce(v_user_exists, false) then
    return query select
      false,
      'invalid_user'::text,
      v_plan_name,
      0,
      v_request_limit,
      v_reset_at,
      now();
    return;
  end if;

  if exists (
    select 1
    from public.subscriptions
    where user_id = p_user_id
      and status = 'active'
      and stripe_subscription_id is not null
  ) then
    v_plan_name := 'Second Brain Pro';
    v_request_limit := v_pro_limit;
  end if;

  insert into public.account_usage_daily (
    user_id,
    bucket_date,
    plan_name,
    request_limit,
    reset_at,
    used
  )
  values (
    p_user_id,
    v_bucket_date,
    v_plan_name,
    v_request_limit,
    v_reset_at,
    0
  )
  on conflict (user_id, bucket_date) do update
  set
    plan_name = excluded.plan_name,
    request_limit = excluded.request_limit,
    reset_at = excluded.reset_at
  returning * into v_usage;

  update public.account_usage_daily as daily_usage
  set
    plan_name = v_plan_name,
    request_limit = v_request_limit,
    reset_at = v_reset_at,
    used = coalesce(daily_usage.used, 0) + p_increment,
    updated_at = now()
  where daily_usage.user_id = p_user_id
    and daily_usage.bucket_date = v_bucket_date
    and coalesce(daily_usage.used, 0) + p_increment <= daily_usage.request_limit
  returning daily_usage.* into v_usage;

  if found then
    return query select
      true,
      null::text,
      v_plan_name,
      coalesce(v_usage.used, 0),
      v_request_limit,
      v_reset_at,
      v_usage.updated_at;
    return;
  end if;

  select *
  into v_usage
  from public.account_usage_daily as daily_usage
  where daily_usage.user_id = p_user_id
    and daily_usage.bucket_date = v_bucket_date;

  return query select
    false,
    'over_limit'::text,
    v_plan_name,
    coalesce(v_usage.used, 0),
    v_request_limit,
    v_reset_at,
    v_usage.updated_at;
end;
$$;

grant execute on function public.consume_proxy_usage(uuid, integer) to service_role;
