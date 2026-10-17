create table if not exists public.controller_settings (
  setting_key text primary key
    check (setting_key = 'hour_alert_lead_minutes'),
  value jsonb not null default '{"minutes":10}'::jsonb
    check (coalesce((value ->> 'minutes') in ('5','10','15','20','30'), false)),
  updated_at timestamptz not null default now()
);

alter table public.controller_settings enable row level security;

drop policy if exists controller_settings_select_controller on public.controller_settings;
drop policy if exists controller_settings_insert_controller on public.controller_settings;
drop policy if exists controller_settings_update_controller on public.controller_settings;

create policy controller_settings_select_controller
  on public.controller_settings for select to authenticated
  using (private.current_rh_has_permission('controller_ver'));

create policy controller_settings_insert_controller
  on public.controller_settings for insert to authenticated
  with check (private.current_rh_has_permission('controller_subpaginas_gerenciar'));

create policy controller_settings_update_controller
  on public.controller_settings for update to authenticated
  using (private.current_rh_has_permission('controller_subpaginas_gerenciar'))
  with check (private.current_rh_has_permission('controller_subpaginas_gerenciar'));
