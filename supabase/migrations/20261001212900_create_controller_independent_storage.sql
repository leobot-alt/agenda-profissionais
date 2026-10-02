create table if not exists public.controller_subpages (
  id text primary key,
  nome text not null,
  descricao text not null default '',
  criada_em timestamptz not null default now(),
  criada_por uuid null references auth.users(id) on delete set null
);

create table if not exists public.controller_collaborators (
  id text primary key,
  nome text not null,
  email text not null default '',
  observacao text not null default '',
  criada_em timestamptz not null default now(),
  criada_por uuid null references auth.users(id) on delete set null
);

alter table public.controller_subpages enable row level security;
alter table public.controller_collaborators enable row level security;

drop policy if exists controller_subpages_select_authenticated on public.controller_subpages;
drop policy if exists controller_subpages_insert_authenticated on public.controller_subpages;
drop policy if exists controller_subpages_update_authenticated on public.controller_subpages;
drop policy if exists controller_subpages_delete_authenticated on public.controller_subpages;
create policy controller_subpages_select_authenticated on public.controller_subpages for select to authenticated using (auth.uid() is not null);
create policy controller_subpages_insert_authenticated on public.controller_subpages for insert to authenticated with check (auth.uid() is not null);
create policy controller_subpages_update_authenticated on public.controller_subpages for update to authenticated using (auth.uid() is not null) with check (auth.uid() is not null);
create policy controller_subpages_delete_authenticated on public.controller_subpages for delete to authenticated using (auth.uid() is not null);

drop policy if exists controller_collaborators_select_authenticated on public.controller_collaborators;
drop policy if exists controller_collaborators_insert_authenticated on public.controller_collaborators;
drop policy if exists controller_collaborators_update_authenticated on public.controller_collaborators;
drop policy if exists controller_collaborators_delete_authenticated on public.controller_collaborators;
create policy controller_collaborators_select_authenticated on public.controller_collaborators for select to authenticated using (auth.uid() is not null);
create policy controller_collaborators_insert_authenticated on public.controller_collaborators for insert to authenticated with check (auth.uid() is not null);
create policy controller_collaborators_update_authenticated on public.controller_collaborators for update to authenticated using (auth.uid() is not null) with check (auth.uid() is not null);
create policy controller_collaborators_delete_authenticated on public.controller_collaborators for delete to authenticated using (auth.uid() is not null);
