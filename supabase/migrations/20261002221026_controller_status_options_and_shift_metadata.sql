alter table public.controller_subpages
  add column if not exists turno text not null default '';

create table if not exists public.controller_status_options (
  status_code text primary key check (status_code ~ '^[a-z0-9_]+$'),
  label text not null check (length(btrim(label)) >= 1 and length(btrim(label)) <= 80),
  active boolean not null default true,
  category text not null default 'em_andamento' check (category in ('pendente','em_andamento','finalizado')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.controller_status_options enable row level security;

drop policy if exists controller_status_options_select on public.controller_status_options;
drop policy if exists controller_status_options_insert on public.controller_status_options;
drop policy if exists controller_status_options_update on public.controller_status_options;
drop policy if exists controller_status_options_delete on public.controller_status_options;

create policy controller_status_options_select
  on public.controller_status_options for select to authenticated
  using (private.current_rh_has_permission('controller_ver'));

create policy controller_status_options_insert
  on public.controller_status_options for insert to authenticated
  with check (private.current_rh_has_permission('controller_subpaginas_gerenciar'));

create policy controller_status_options_update
  on public.controller_status_options for update to authenticated
  using (private.current_rh_has_permission('controller_subpaginas_gerenciar'))
  with check (private.current_rh_has_permission('controller_subpaginas_gerenciar'));

create policy controller_status_options_delete
  on public.controller_status_options for delete to authenticated
  using (private.current_rh_has_permission('controller_subpaginas_gerenciar'));

insert into public.controller_status_options (status_code, label, active, category, sort_order)
values
  ('pendente', 'Pendente', true, 'pendente', 10),
  ('atendido', 'Atendido', true, 'finalizado', 20),
  ('falta', 'Falta', true, 'finalizado', 30),
  ('pro_faltou', 'Profissional faltou', true, 'finalizado', 40),
  ('cancelado', 'Cancelado', true, 'finalizado', 50),
  ('remanejado', 'Remanejado', true, 'finalizado', 60),
  ('ajuste_necessario', 'Ajuste necessário', true, 'em_andamento', 70)
on conflict (status_code) do nothing;
