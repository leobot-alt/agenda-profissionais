alter table public.recibos_recebidos
  add column if not exists updated_by_name text not null default '';

update public.recibos_recebidos rr
set updated_by_name = coalesce(
  nullif(pg_catalog.btrim(u.nome_completo), ''),
  nullif(pg_catalog.btrim(u.username), ''),
  ''
)
from public.usuarios_rh u
where rr.updated_by = u.auth_user_id
  and rr.updated_by_name = '';

create or replace function private.set_recibos_recebidos_updated_by()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_user_name text;
begin
  if auth.uid() is null then
    raise exception 'Usuário autenticado obrigatório para atualizar o status.';
  end if;

  select coalesce(
    nullif(pg_catalog.btrim(u.nome_completo), ''),
    nullif(pg_catalog.btrim(u.username), ''),
    ''
  )
  into v_user_name
  from public.usuarios_rh u
  where u.auth_user_id = auth.uid()
    and u.ativo is true
    and u.removido is false
  limit 1;

  new.updated_by := auth.uid();
  new.updated_by_name := coalesce(
    nullif(v_user_name, ''),
    nullif(auth.jwt() ->> 'email', ''),
    'Usuário autenticado'
  );
  return new;
end;
$$;

drop trigger if exists recibos_recebidos_set_updated_by
  on public.recibos_recebidos;
create trigger recibos_recebidos_set_updated_by
  before insert or update on public.recibos_recebidos
  for each row execute function private.set_recibos_recebidos_updated_by();

comment on column public.recibos_recebidos.updated_by_name is
  'Nome de perfil registrado pelo banco para identificar o último usuário que atualizou o status.';
