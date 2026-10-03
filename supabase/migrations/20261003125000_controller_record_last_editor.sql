-- Registra o responsável pela criação/última alteração em cada atendimento do Controller.
alter table public.controller_page_records
  add column if not exists atualizado_por text;

create or replace function public.controller_stamp_record_editor()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_actor_name text;
  v_actor_email text;
begin
  select nullif(btrim(u.nome_completo), '')
    into v_actor_name
    from public.usuarios_rh u
   where u.auth_user_id = auth.uid()
     and u.ativo is true
     and u.removido is false
   limit 1;

  v_actor_email := nullif(btrim(auth.jwt() ->> 'email'), '');
  new.atualizado_em := now();
  new.atualizado_por := coalesce(v_actor_name, v_actor_email, auth.uid()::text, 'Sistema');
  return new;
end;
$$;

drop trigger if exists controller_stamp_record_editor on public.controller_page_records;
create trigger controller_stamp_record_editor
  before insert or update on public.controller_page_records
  for each row execute function public.controller_stamp_record_editor();
