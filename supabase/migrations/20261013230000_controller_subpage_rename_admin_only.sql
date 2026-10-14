-- Restringe a renomeação das áreas do Controller a Administrador e Administrador geral.
-- A política de UPDATE existente permanece inalterada para preservar edição de turno.
create or replace function public.controller_guard_subpage_name_update()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_profile text;
begin
  if new.nome is not distinct from old.nome then
    return new;
  end if;

  select lower(btrim(u.perfil))
    into v_profile
    from public.usuarios_rh u
   where u.auth_user_id = auth.uid()
     and u.ativo is true
     and u.removido is false
   limit 1;

  if v_profile not in ('administrador', 'administrador_geral') then
    raise exception 'Apenas perfis Administrador e Administrador geral podem alterar o nome da área de acompanhamento.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function public.controller_guard_subpage_name_update() from public, anon, authenticated;

drop trigger if exists controller_guard_subpage_name_update on public.controller_subpages;
create trigger controller_guard_subpage_name_update
before update of nome on public.controller_subpages
for each row execute function public.controller_guard_subpage_name_update();
