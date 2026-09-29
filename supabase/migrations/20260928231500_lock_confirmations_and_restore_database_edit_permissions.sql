-- Conferências já realizadas só podem ser removidas por Administração, Administrador geral ou Gestão.
update public.usuarios_rh
set permissions = case
  when jsonb_typeof(coalesce(permissions, '[]'::jsonb)) = 'array' then (
    select coalesce(jsonb_agg(distinct value order by value), '[]'::jsonb)
    from jsonb_array_elements_text(coalesce(permissions, '[]'::jsonb) || '["agendas_ativas_conferencia_remover","banco_profissionais_editar"]'::jsonb) as items(value)
  )
  else '["agendas_ativas_conferencia_remover","banco_profissionais_editar"]'::jsonb
end,
updated_at = now()
where perfil in ('administrador','administrador_geral','gestao')
  and ativo = true
  and removido = false;

-- Permissões explícitas também autorizam a edição do Banco de Dados para perfis compatíveis.
drop policy if exists profissionais_gestao_or_adjustment_select on public.profissionais;
create policy profissionais_gestao_or_adjustment_select
  on public.profissionais for select to authenticated
  using (private.is_rh_gestao() or private.current_rh_has_permission('banco_profissionais_editar') or private.current_rh_has_permission('ajustes_solicitar') or private.current_rh_has_permission('ajustes_analisar'));

drop policy if exists profissionais_gestao_insert on public.profissionais;
create policy profissionais_gestao_insert
  on public.profissionais for insert to authenticated
  with check (private.is_rh_gestao() or private.current_rh_has_permission('banco_profissionais_editar'));

drop policy if exists profissionais_gestao_update on public.profissionais;
create policy profissionais_gestao_update
  on public.profissionais for update to authenticated
  using (private.is_rh_gestao() or private.current_rh_has_permission('banco_profissionais_editar'))
  with check (private.is_rh_gestao() or private.current_rh_has_permission('banco_profissionais_editar'));

create or replace function public.registrar_conferencia_agenda_dia(p_agenda_id text, p_mes text, p_iso date, p_conferido boolean)
returns table (agenda_id text, mes text, iso date, conferido boolean, conferido_em timestamptz, conferido_por_auth_id uuid, conferido_por_nome text)
language plpgsql security definer set search_path = pg_catalog, public, auth, private
as $function$
declare v_agenda public.agendas%rowtype; v_nome text; v_now timestamptz;
begin
  if auth.uid() is null then raise exception 'Usuário não autenticado.' using errcode = '42501'; end if;
  select * into v_agenda from public.agendas a where a.id = p_agenda_id limit 1;
  if not found then raise exception 'Agenda não encontrada.' using errcode = 'P0002'; end if;
  if not (v_agenda.submitted_by_auth_id = auth.uid() or private.is_rh_gestao() or (v_agenda.status = 'aprovado' and private.current_rh_has_permission('agendas_ativas_conferir') and exists (select 1 from public.usuarios_rh u where u.auth_user_id = auth.uid() and u.ativo = true and u.removido = false and u.perfil = 'colaborador' and nullif(trim(u.operacao), '') = nullif(trim(v_agenda.operacao), '')))) then
    raise exception 'Você não tem permissão para conferir esta agenda.' using errcode = '42501';
  end if;
  if not coalesce(p_conferido, false) and not (private.is_rh_gestao() or private.current_rh_has_permission('agendas_ativas_conferencia_remover')) then
    raise exception 'Somente Administração ou Gestão pode remover uma conferência já realizada.' using errcode = '42501';
  end if;
  select coalesce(u.nome_completo, u.username, '') into v_nome from public.usuarios_rh u where u.auth_user_id = auth.uid() limit 1;
  v_nome := coalesce(nullif(trim(v_nome), ''), auth.uid()::text); v_now := case when p_conferido then now() else null end;
  update public.agenda_dias d
  set conferido = coalesce(p_conferido, false), conferido_em = v_now, conferido_por_auth_id = case when p_conferido then auth.uid() else null end, conferido_por_nome = case when p_conferido then v_nome else '' end,
      dados = case when p_conferido then jsonb_set(jsonb_set(jsonb_set(coalesce(d.dados, '{}'::jsonb), '{conferido}', 'true'::jsonb, true), '{conferidoEm}', to_jsonb(v_now), true), '{conferidoPorNome}', to_jsonb(v_nome), true) else jsonb_set((coalesce(d.dados, '{}'::jsonb) - 'conferidoEm' - 'conferidoPor' - 'conferidoPorNome'), '{conferido}', 'false'::jsonb, true) end
  where d.agenda_id = p_agenda_id and d.mes = p_mes and d.iso = p_iso
  returning d.agenda_id, d.mes, d.iso, d.conferido, d.conferido_em, d.conferido_por_auth_id, d.conferido_por_nome into agenda_id, mes, iso, conferido, conferido_em, conferido_por_auth_id, conferido_por_nome;
  if not found then raise exception 'Dia da agenda não encontrado.' using errcode = 'P0002'; end if;
  return next;
end;
$function$;

grant execute on function public.registrar_conferencia_agenda_dia(text, text, date, boolean) to authenticated;
