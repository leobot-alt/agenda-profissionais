-- Controller: permissions for viewing, importing, managing subpages and updating records.

update public.usuarios_rh
set permissions = coalesce(permissions, '[]'::jsonb) || case
  when perfil in ('administrador', 'administrador_geral', 'gestao') then
    '["controller_ver","controller_dashboard_ver","controller_status_atual_editar","controller_importar","controller_subpaginas_gerenciar","controller_registros_criar","controller_registros_excluir"]'::jsonb
  when perfil = 'colaborador' then
    '["controller_ver","controller_status_atual_editar"]'::jsonb
  else '[]'::jsonb
end
where ativo = true and removido = false
  and perfil in ('administrador', 'administrador_geral', 'gestao', 'colaborador');

alter table public.controller_subpages enable row level security;
drop policy if exists controller_subpages_select_authenticated on public.controller_subpages;
drop policy if exists controller_subpages_insert_authenticated on public.controller_subpages;
drop policy if exists controller_subpages_update_authenticated on public.controller_subpages;
drop policy if exists controller_subpages_delete_authenticated on public.controller_subpages;
create policy controller_subpages_select_controller on public.controller_subpages
  for select to authenticated using (private.current_rh_has_permission('controller_ver'));
create policy controller_subpages_insert_controller on public.controller_subpages
  for insert to authenticated with check (
    private.current_rh_has_permission('controller_subpaginas_gerenciar')
    or private.current_rh_has_permission('controller_importar')
  );
create policy controller_subpages_update_controller on public.controller_subpages
  for update to authenticated using (private.current_rh_has_permission('controller_subpaginas_gerenciar'))
  with check (private.current_rh_has_permission('controller_subpaginas_gerenciar'));
create policy controller_subpages_delete_controller on public.controller_subpages
  for delete to authenticated using (private.current_rh_has_permission('controller_subpaginas_gerenciar'));

alter table public.controller_page_records enable row level security;
drop policy if exists controller_page_records_select_authenticated on public.controller_page_records;
drop policy if exists controller_page_records_insert_authenticated on public.controller_page_records;
drop policy if exists controller_page_records_update_authenticated on public.controller_page_records;
drop policy if exists controller_page_records_delete_authenticated on public.controller_page_records;
create policy controller_page_records_select_controller on public.controller_page_records
  for select to authenticated using (private.current_rh_has_permission('controller_ver'));
create policy controller_page_records_insert_controller on public.controller_page_records
  for insert to authenticated with check (
    private.current_rh_has_permission('controller_importar')
    or private.current_rh_has_permission('controller_registros_criar')
  );
create policy controller_page_records_update_controller on public.controller_page_records
  for update to authenticated using (private.current_rh_has_permission('controller_status_atual_editar'))
  with check (private.current_rh_has_permission('controller_status_atual_editar'));
create policy controller_page_records_delete_controller on public.controller_page_records
  for delete to authenticated using (private.current_rh_has_permission('controller_registros_excluir'));

create or replace function public.controller_guard_record_update()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if not (
    private.current_rh_has_permission('controller_importar')
    or private.current_rh_has_permission('controller_subpaginas_gerenciar')
  ) then
    if new.page_id is distinct from old.page_id
      or new.operador is distinct from old.operador
      or new.profissional is distinct from old.profissional
      or new.data_atendimento is distinct from old.data_atendimento
      or new.hora_atendimento is distinct from old.hora_atendimento
      or new.status_original is distinct from old.status_original
      or new.observacao is distinct from old.observacao
      or new.criado_em is distinct from old.criado_em
      or new.criado_por is distinct from old.criado_por then
      raise exception 'Somente o Status atual pode ser alterado por este perfil';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists controller_guard_record_update on public.controller_page_records;
create trigger controller_guard_record_update
before update on public.controller_page_records
for each row execute function public.controller_guard_record_update();
