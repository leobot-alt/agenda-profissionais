create table if not exists public.controller_page_records (
  id text primary key,
  page_id text not null references public.controller_subpages(id) on delete cascade,
  profissional text not null,
  data_atendimento date not null,
  hora_atendimento time not null,
  status text not null default 'pendente',
  observacao text not null default '',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid null references auth.users(id) on delete set null
);

alter table public.controller_page_records enable row level security;
drop policy if exists controller_page_records_select_authenticated on public.controller_page_records;
drop policy if exists controller_page_records_insert_authenticated on public.controller_page_records;
drop policy if exists controller_page_records_update_authenticated on public.controller_page_records;
drop policy if exists controller_page_records_delete_authenticated on public.controller_page_records;
create policy controller_page_records_select_authenticated on public.controller_page_records for select to authenticated using (auth.uid() is not null);
create policy controller_page_records_insert_authenticated on public.controller_page_records for insert to authenticated with check (auth.uid() is not null);
create policy controller_page_records_update_authenticated on public.controller_page_records for update to authenticated using (auth.uid() is not null) with check (auth.uid() is not null);
create policy controller_page_records_delete_authenticated on public.controller_page_records for delete to authenticated using (auth.uid() is not null);
