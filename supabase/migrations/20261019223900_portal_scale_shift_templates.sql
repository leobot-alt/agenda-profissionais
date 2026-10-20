create table if not exists public.portal_scale_settings (
  setting_key text primary key check (setting_key = 'shift_templates'),
  value jsonb not null default '{}'::jsonb check (jsonb_typeof(value) = 'object'),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

comment on table public.portal_scale_settings is
  'Modelos administrativos de horários de turno usados ao gerar escalas mensais no Portal.';

alter table public.portal_scale_settings enable row level security;

drop policy if exists portal_scale_settings_select_manager on public.portal_scale_settings;
create policy portal_scale_settings_select_manager
  on public.portal_scale_settings for select to authenticated
  using (private.current_rh_has_permission('portal_escala_gerenciar'));

drop policy if exists portal_scale_settings_insert_manager on public.portal_scale_settings;
create policy portal_scale_settings_insert_manager
  on public.portal_scale_settings for insert to authenticated
  with check (private.current_rh_has_permission('portal_escala_gerenciar'));

drop policy if exists portal_scale_settings_update_manager on public.portal_scale_settings;
create policy portal_scale_settings_update_manager
  on public.portal_scale_settings for update to authenticated
  using (private.current_rh_has_permission('portal_escala_gerenciar'))
  with check (private.current_rh_has_permission('portal_escala_gerenciar'));

grant select, insert, update on public.portal_scale_settings to authenticated;
