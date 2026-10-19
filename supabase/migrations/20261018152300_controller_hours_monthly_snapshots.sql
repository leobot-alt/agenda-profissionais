create table if not exists public.controller_hours_monthly_snapshots (
  division_date date primary key,
  assignments jsonb not null default '[]'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint controller_hours_monthly_snapshots_assignments_array
    check (jsonb_typeof(assignments) = 'array')
);

comment on table public.controller_hours_monthly_snapshots is
  'Snapshots diários da Divisão de horas usados para manter continuidade de profissionais e equilíbrio de carga dentro do mês.';
comment on column public.controller_hours_monthly_snapshots.assignments is
  'Resumo agregado por grupo de turnos, profissional e colaborador; não contém as linhas individuais do relatório.';

alter table public.controller_hours_monthly_snapshots enable row level security;

drop policy if exists controller_hours_monthly_snapshots_select_authenticated
  on public.controller_hours_monthly_snapshots;
create policy controller_hours_monthly_snapshots_select_authenticated
  on public.controller_hours_monthly_snapshots
  for select to authenticated
  using (auth.uid() is not null);

drop policy if exists controller_hours_monthly_snapshots_insert_authenticated
  on public.controller_hours_monthly_snapshots;
create policy controller_hours_monthly_snapshots_insert_authenticated
  on public.controller_hours_monthly_snapshots
  for insert to authenticated
  with check (auth.uid() is not null);

drop policy if exists controller_hours_monthly_snapshots_update_authenticated
  on public.controller_hours_monthly_snapshots;
create policy controller_hours_monthly_snapshots_update_authenticated
  on public.controller_hours_monthly_snapshots
  for update to authenticated
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

grant select, insert, update on public.controller_hours_monthly_snapshots to authenticated;
