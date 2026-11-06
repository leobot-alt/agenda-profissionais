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
  new.updated_at := pg_catalog.statement_timestamp();
  return new;
end;
$$;
