-- Permite arquivar qualquer status, inclusive Pendente e DISPONÍVEL, sem
-- apagar suas definições nem as referências históricas dos atendimentos.
alter table public.controller_status_options
  add column if not exists archived boolean not null default false;

-- A gestão agora arquiva os status reversivelmente; retire o bloqueio legado
-- que proibia desativar/remover o status Pendente.
drop trigger if exists controller_guard_pending_status_option
  on public.controller_status_options;

-- Status-base podem continuar surgindo de defaults/importações se arquivados.
-- Os demais só podem ser aplicados quando disponíveis e não arquivados.
create or replace function public.controller_validate_enabled_status()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  status_is_active boolean;
  status_is_archived boolean;
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return new;
  end if;

  if new.status in ('pendente', 'disponivel') then
    return new;
  end if;

  select active, archived
    into status_is_active, status_is_archived
    from public.controller_status_options
   where status_code = new.status;

  if status_is_active is distinct from true or status_is_archived is distinct from false then
    raise exception 'O status informado não está habilitado no Controller';
  end if;

  return new;
end;
$$;
