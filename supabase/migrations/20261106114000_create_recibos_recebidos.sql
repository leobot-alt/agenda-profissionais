create table if not exists public.recibos_recebidos (
  profissional_id text not null,
  competencia text not null,
  status text not null default 'pendente',
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recibos_recebidos_competencia_format
    check (competencia ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  constraint recibos_recebidos_status_valid
    check (status in ('enviado', 'coletado', 'nao_enviado', 'pendente')),
  constraint recibos_recebidos_profissional_competencia_pk
    primary key (profissional_id, competencia)
);

comment on table public.recibos_recebidos is
  'Status mensal de recebimento de recibos por profissional.';

alter table public.recibos_recebidos enable row level security;

drop policy if exists recibos_recebidos_select_professional_managers
  on public.recibos_recebidos;
create policy recibos_recebidos_select_professional_managers
  on public.recibos_recebidos
  for select to authenticated
  using (private.current_rh_has_permission('banco_profissionais_editar'));

drop policy if exists recibos_recebidos_insert_professional_managers
  on public.recibos_recebidos;
create policy recibos_recebidos_insert_professional_managers
  on public.recibos_recebidos
  for insert to authenticated
  with check (private.current_rh_has_permission('banco_profissionais_editar'));

drop policy if exists recibos_recebidos_update_professional_managers
  on public.recibos_recebidos;
create policy recibos_recebidos_update_professional_managers
  on public.recibos_recebidos
  for update to authenticated
  using (private.current_rh_has_permission('banco_profissionais_editar'))
  with check (private.current_rh_has_permission('banco_profissionais_editar'));

grant select, insert, update on public.recibos_recebidos to authenticated;
