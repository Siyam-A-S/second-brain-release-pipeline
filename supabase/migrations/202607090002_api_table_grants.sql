grant select on public.subscriptions to authenticated;
grant select, insert, update, delete on public.subscriptions to service_role;

grant insert on public.desktop_log_events to authenticated;
grant select, insert, update, delete on public.desktop_log_events to service_role;
