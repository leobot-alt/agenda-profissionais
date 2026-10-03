create or replace function public.controller_guard_pending_status_option()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if old.status_code = 'pendente' then
    if tg_op = 'DELETE' then
      raise exception 'O status Pendente é obrigatório no Controller';
    end if;
    if new.active is distinct from true then
      raise exception 'O status Pendente deve permanecer ativo no Controller';
    end if;
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists controller_guard_pending_status_option on public.controller_status_options;
create trigger controller_guard_pending_status_option
  before update or delete on public.controller_status_options
  for each row execute function public.controller_guard_pending_status_option();

create or replace function public.controller_validate_enabled_status()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  status_is_active boolean;
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return new;
  end if;

  select active
    into status_is_active
    from public.controller_status_options
   where status_code = new.status;

  if status_is_active is distinct from true then
    raise exception 'O status informado não está habilitado no Controller';
  end if;

  return new;
end;
$$;

drop trigger if exists controller_validate_enabled_status on public.controller_page_records;
create trigger controller_validate_enabled_status
  before insert or update on public.controller_page_records
  for each row execute function public.controller_validate_enabled_status();
