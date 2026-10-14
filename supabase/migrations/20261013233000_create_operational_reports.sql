begin;

create table if not exists public.operational_reports (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 160),
  period text not null default '' check (char_length(period) <= 240),
  encrypted_payload jsonb not null check (jsonb_typeof(encrypted_payload) = 'object'),
  created_at timestamptz not null default now()
);

create index if not exists operational_reports_creator_created_idx
  on public.operational_reports (creator_id, created_at desc);

alter table public.operational_reports enable row level security;

revoke all on table public.operational_reports from public, anon;
grant select, insert, delete on table public.operational_reports to authenticated;

drop policy if exists operational_reports_select_owner_admin on public.operational_reports;
create policy operational_reports_select_owner_admin
  on public.operational_reports
  for select
  to authenticated
  using (creator_id = (select auth.uid()) and (select private.is_rh_admin()));

drop policy if exists operational_reports_insert_owner_admin on public.operational_reports;
create policy operational_reports_insert_owner_admin
  on public.operational_reports
  for insert
  to authenticated
  with check (creator_id = (select auth.uid()) and (select private.is_rh_admin()));

drop policy if exists operational_reports_delete_owner_admin on public.operational_reports;
create policy operational_reports_delete_owner_admin
  on public.operational_reports
  for delete
  to authenticated
  using (creator_id = (select auth.uid()) and (select private.is_rh_admin()));

comment on table public.operational_reports is
  'Relatórios operacionais com conteúdo criptografado no navegador; RLS limita acesso ao criador ativo Administrador/Administrador geral.';

commit;
