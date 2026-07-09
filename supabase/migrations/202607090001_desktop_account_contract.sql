alter table public.subscriptions
  add column if not exists plan_name text not null default 'Second Brain Pro',
  add column if not exists subscription_renews_at timestamptz,
  add column if not exists usage_period_start timestamptz,
  add column if not exists usage_period_end timestamptz,
  add column if not exists usage_requests integer not null default 0,
  add column if not exists usage_request_limit integer not null default 1000;

alter table public.desktop_log_events
  add column if not exists platform text,
  add column if not exists arch text;

create index if not exists desktop_log_events_user_device_created_idx
on public.desktop_log_events (user_id, device_id, created_at desc);
