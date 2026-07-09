create or replace function public.consume_proxy_usage(
  p_user_id uuid,
  p_increment integer default 1
)
returns table (
  allowed boolean,
  reason text,
  status text,
  plan_name text,
  usage_requests integer,
  usage_request_limit integer,
  usage_period_start timestamptz,
  usage_period_end timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period_start timestamptz := date_trunc('month', now());
  v_period_end timestamptz := date_trunc('month', now()) + interval '1 month';
  v_row public.subscriptions%rowtype;
  v_current_requests integer;
  v_limit integer;
begin
  if p_increment is null or p_increment < 1 then
    p_increment := 1;
  end if;

  select *
  into v_row
  from public.subscriptions
  where user_id = p_user_id
  for update;

  if not found then
    return query select
      false,
      'no_subscription'::text,
      null::text,
      'Second Brain Pro'::text,
      0,
      1000,
      v_period_start,
      v_period_end;
    return;
  end if;

  v_limit := coalesce(v_row.usage_request_limit, 1000);
  v_current_requests := case
    when v_row.usage_period_start = v_period_start
      and v_row.usage_period_end = v_period_end
    then coalesce(v_row.usage_requests, 0)
    else 0
  end;

  if coalesce(v_row.status, '') not in ('active', 'trialing') then
    return query select
      false,
      'inactive'::text,
      v_row.status,
      coalesce(v_row.plan_name, 'Second Brain Pro'),
      v_current_requests,
      v_limit,
      v_period_start,
      v_period_end;
    return;
  end if;

  if v_current_requests + p_increment > v_limit then
    return query select
      false,
      'over_limit'::text,
      v_row.status,
      coalesce(v_row.plan_name, 'Second Brain Pro'),
      v_current_requests,
      v_limit,
      v_period_start,
      v_period_end;
    return;
  end if;

  update public.subscriptions
  set
    usage_period_start = v_period_start,
    usage_period_end = v_period_end,
    usage_requests = v_current_requests + p_increment,
    updated_at = now()
  where user_id = p_user_id
  returning * into v_row;

  return query select
    true,
    null::text,
    v_row.status,
    coalesce(v_row.plan_name, 'Second Brain Pro'),
    coalesce(v_row.usage_requests, 0),
    coalesce(v_row.usage_request_limit, 1000),
    v_row.usage_period_start,
    v_row.usage_period_end;
end;
$$;

grant execute on function public.consume_proxy_usage(uuid, integer) to service_role;
