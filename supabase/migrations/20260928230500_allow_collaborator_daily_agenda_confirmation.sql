-- Permite registrar, consultar e auditar a conferência diária sem liberar edição da agenda.
alter table public.agenda_dias
  add column if not exists conferido_em timestamptz,
  add column if not exists conferido_por_auth_id uuid references auth.users(id),
  add column if not exists conferido_por_nome text not null default '';

update public.usuarios_rh
set permissions = case
  when jsonb_typeof(coalesce(permissions, '[]'::jsonb)) = 'array'
    then case when coalesce(permissions, '[]'::jsonb) ? 'agendas_ativas_conferir'
      then coalesce(permissions, '[]'::jsonb)
      else coalesce(permissions, '[]'::jsonb) || '["agendas_ativas_conferir"]'::jsonb
    end
  else '["agendas_ativas_conferir"]'::jsonb
end,
updated_at = now()
where perfil = 'colaborador'
  and ativo = true
  and removido = false;

drop policy if exists agenda_dias_agenda_scope_select on public.agenda_dias;
create policy agenda_dias_agenda_scope_select
  on public.agenda_dias
  for select
  to authenticated
  using (
    exists (
      select 1 from public.agendas a
      where a.id = agenda_dias.agenda_id
        and (
          a.submitted_by_auth_id = auth.uid()
          or private.is_rh_gestao()
          or (
            a.status = 'aprovado'
            and private.current_rh_has_permission('agendas_ativas_ver')
            and exists (
              select 1 from public.usuarios_rh u
              where u.auth_user_id = auth.uid()
                and u.ativo = true
                and u.removido = false
                and u.perfil = 'colaborador'
                and nullif(trim(u.operacao), '') = nullif(trim(a.operacao), '')
            )
          )
        )
    )
  );

create or replace function public.registrar_conferencia_agenda_dia(
  p_agenda_id text,
  p_mes text,
  p_iso date,
  p_conferido boolean
)
returns table (
  agenda_id text,
  mes text,
  iso date,
  conferido boolean,
  conferido_em timestamptz,
  conferido_por_auth_id uuid,
  conferido_por_nome text
)
language plpgsql
security definer
set search_path = pg_catalog, public, auth, private
as $function$
declare
  v_agenda public.agendas%rowtype;
  v_nome text;
  v_now timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado.' using errcode = '42501';
  end if;

  select * into v_agenda
  from public.agendas a
  where a.id = p_agenda_id
  limit 1;

  if not found then
    raise exception 'Agenda não encontrada.' using errcode = 'P0002';
  end if;

  if not (
    v_agenda.submitted_by_auth_id = auth.uid()
    or private.is_rh_gestao()
    or (
      v_agenda.status = 'aprovado'
      and private.current_rh_has_permission('agendas_ativas_conferir')
      and exists (
        select 1 from public.usuarios_rh u
        where u.auth_user_id = auth.uid()
          and u.ativo = true
          and u.removido = false
          and u.perfil = 'colaborador'
          and nullif(trim(u.operacao), '') = nullif(trim(v_agenda.operacao), '')
      )
    )
  ) then
    raise exception 'Você não tem permissão para conferir esta agenda.' using errcode = '42501';
  end if;

  select coalesce(u.nome_completo, u.username, '') into v_nome
  from public.usuarios_rh u
  where u.auth_user_id = auth.uid()
  limit 1;
  v_nome := coalesce(nullif(trim(v_nome), ''), auth.uid()::text);
  v_now := case when p_conferido then now() else null end;

  update public.agenda_dias d
  set conferido = coalesce(p_conferido, false),
      conferido_em = v_now,
      conferido_por_auth_id = case when p_conferido then auth.uid() else null end,
      conferido_por_nome = case when p_conferido then v_nome else '' end,
      dados = case
        when p_conferido then jsonb_set(
          jsonb_set(
            jsonb_set(coalesce(d.dados, '{}'::jsonb), '{conferido}', 'true'::jsonb, true),
            '{conferidoEm}', to_jsonb(v_now), true
          ),
          '{conferidoPorNome}', to_jsonb(v_nome), true
        )
        else jsonb_set(
          (coalesce(d.dados, '{}'::jsonb) - 'conferidoEm' - 'conferidoPor' - 'conferidoPorNome'),
          '{conferido}', 'false'::jsonb, true
        )
      end
  where d.agenda_id = p_agenda_id
    and d.mes = p_mes
    and d.iso = p_iso
  returning d.agenda_id, d.mes, d.iso, d.conferido, d.conferido_em, d.conferido_por_auth_id, d.conferido_por_nome
  into agenda_id, mes, iso, conferido, conferido_em, conferido_por_auth_id, conferido_por_nome;

  if not found then
    raise exception 'Dia da agenda não encontrado.' using errcode = 'P0002';
  end if;

  return next;
end;
$function$;

grant execute on function public.registrar_conferencia_agenda_dia(text, text, date, boolean) to authenticated;
