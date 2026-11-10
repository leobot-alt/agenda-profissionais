create or replace function public.controller_validate_enabled_status()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  status_is_active boolean;
  status_is_archived boolean;
  status_is_admin_only boolean;
  previous_status_is_admin_only boolean;
  current_user_is_admin boolean;
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    select coalesce(admin_only, false)
      into previous_status_is_admin_only
      from public.controller_status_options
     where status_code = old.status;

    if previous_status_is_admin_only is true then
      select exists (
        select 1
          from public.usuarios_rh u
         where u.auth_user_id = auth.uid()
           and u.ativo = true
           and u.removido = false
           and lower(regexp_replace(coalesce(u.perfil, ''), '[^a-zA-Z0-9]', '', 'g'))
               in ('administrador', 'admin', 'adm', 'administradorgeral', 'admgeneral', 'admgeral')
      ) into current_user_is_admin;

      if current_user_is_admin is distinct from true then
        raise exception 'Somente Administrador e Administrador Geral podem remover ou trocar este status';
      end if;
    end if;
  end if;

  if new.status in ('pendente', 'disponivel') then
    return new;
  end if;

  select active, archived, admin_only
    into status_is_active, status_is_archived, status_is_admin_only
    from public.controller_status_options
   where status_code = new.status;

  if status_is_active is distinct from true or status_is_archived is distinct from false then
    raise exception 'O status informado não está habilitado no Controller';
  end if;

  if status_is_admin_only is true then
    select exists (
      select 1
        from public.usuarios_rh u
       where u.auth_user_id = auth.uid()
         and u.ativo = true
         and u.removido = false
         and lower(regexp_replace(coalesce(u.perfil, ''), '[^a-zA-Z0-9]', '', 'g'))
             in ('administrador', 'admin', 'adm', 'administradorgeral', 'admgeneral', 'admgeral')
    ) into current_user_is_admin;

    if current_user_is_admin is distinct from true then
      raise exception 'Somente Administrador e Administrador Geral podem aplicar este status';
    end if;
  end if;

  return new;
end;
$$;
