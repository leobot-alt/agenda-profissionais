-- Permite que colaboradores atualizem também a observação de um atendimento.
-- O horário da última alteração é definido pelo banco para manter um registro confiável.
create or replace function public.controller_guard_record_update()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  new.atualizado_em := now();

  if not (
    private.current_rh_has_permission('controller_importar')
    or private.current_rh_has_permission('controller_subpaginas_gerenciar')
  ) then
    if new.page_id is distinct from old.page_id
      or new.operador is distinct from old.operador
      or new.profissional is distinct from old.profissional
      or new.data_atendimento is distinct from old.data_atendimento
      or new.hora_atendimento is distinct from old.hora_atendimento
      or new.status_original is distinct from old.status_original
      or new.criado_em is distinct from old.criado_em
      or new.criado_por is distinct from old.criado_por then
      raise exception 'Somente o Status atual e a Observação podem ser alterados por este perfil';
    end if;
  end if;

  return new;
end;
$$;
