-- Permite que colaboradores consultem somente agendas aprovadas da própria operação.
-- A leitura continua protegida por autenticação, permissão e escopo operacional.
update public.usuarios_rh
set permissions = case
  when jsonb_typeof(coalesce(permissions, '[]'::jsonb)) = 'array'
    then case when coalesce(permissions, '[]'::jsonb) ? 'agendas_ativas_ver'
      then coalesce(permissions, '[]'::jsonb)
      else coalesce(permissions, '[]'::jsonb) || '["agendas_ativas_ver"]'::jsonb
    end
  else '["agendas_ativas_ver"]'::jsonb
end,
updated_at = now()
where perfil = 'colaborador'
  and ativo = true
  and removido = false;

drop policy if exists agendas_owner_or_gestao_select on public.agendas;
drop policy if exists agendas_owner_gestao_or_operation_select on public.agendas;
create policy agendas_owner_gestao_or_operation_select
  on public.agendas
  for select
  to authenticated
  using (
    submitted_by_auth_id = auth.uid()
    or private.is_rh_gestao()
    or (
      status = 'aprovado'
      and private.current_rh_has_permission('agendas_ativas_ver')
      and exists (
        select 1
        from public.usuarios_rh u
        where u.auth_user_id = auth.uid()
          and u.ativo = true
          and u.removido = false
          and u.perfil = 'colaborador'
          and nullif(trim(u.operacao), '') = nullif(trim(public.agendas.operacao), '')
      )
    )
  );
