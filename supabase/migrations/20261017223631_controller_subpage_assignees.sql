alter table public.controller_subpages
  add column if not exists responsavel_auth_id uuid
    references auth.users(id) on delete set null;

create or replace function public.controller_guard_subpage_responsavel()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if tg_op = 'INSERT' and new.responsavel_auth_id is null then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and new.responsavel_auth_id is not distinct from old.responsavel_auth_id then
    return new;
  end if;

  if not private.current_rh_has_permission('controller_subpaginas_gerenciar') then
    raise exception 'Somente usuários autorizados podem atribuir responsáveis às áreas do Controller.';
  end if;

  if new.responsavel_auth_id is not null and not exists (
    select 1
    from public.usuarios_rh u
    where u.auth_user_id = new.responsavel_auth_id
      and u.ativo is true
      and u.removido is false
      and u.permissions @> '["controller_ver"]'::jsonb
  ) then
    raise exception 'O responsável precisa ser um usuário ativo com acesso ao Controller.';
  end if;

  return new;
end;
$$;

drop trigger if exists controller_guard_subpage_responsavel
  on public.controller_subpages;

create trigger controller_guard_subpage_responsavel
  before insert or update on public.controller_subpages
  for each row execute function public.controller_guard_subpage_responsavel();
