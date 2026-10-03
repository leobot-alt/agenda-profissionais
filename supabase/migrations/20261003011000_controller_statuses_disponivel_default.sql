-- O status DISPONÍVEL passa a ser o padrão obrigatório para novos atendimentos.
-- Os códigos anteriores ficam inativos, mas preservados para históricos já gravados.
create or replace function public.controller_guard_pending_status_option()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if old.status_code = 'disponivel' then
    if tg_op = 'DELETE' then
      raise exception 'O status DISPONÍVEL é obrigatório no Controller';
    end if;
    if new.active is distinct from true then
      raise exception 'O status DISPONÍVEL deve permanecer ativo no Controller';
    end if;
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

alter table public.controller_page_records
  alter column status set default 'disponivel';

insert into public.controller_status_options (status_code, label, active, category, sort_order)
values
  ('disponivel', 'DISPONÍVEL', true, 'pendente', 10),
  ('atendido', 'ATENDIDO', true, 'finalizado', 20),
  ('bloqueado', 'BLOQUEADO', true, 'em_andamento', 30),
  ('cancelado', 'CANCELADO', true, 'finalizado', 40),
  ('desmarcado', 'DESMARCADO', true, 'finalizado', 50),
  ('desmarcado_pro', 'DESMARCADO PRO', true, 'finalizado', 60),
  ('faltou', 'FALTOU', true, 'finalizado', 70),
  ('horario_reservado_lideranca', 'HORÁRIO RESERVADO/LIDERANÇA', true, 'em_andamento', 80),
  ('pro_faltou', 'PRO FALTOU', true, 'finalizado', 90),
  ('remanejar', 'REMANEJAR', true, 'em_andamento', 100),
  ('pendente', 'Pendente', false, 'pendente', 900),
  ('falta', 'Falta', false, 'finalizado', 910),
  ('remanejado', 'Remanejado', false, 'finalizado', 920),
  ('ajuste_necessario', 'Ajuste necessário', false, 'em_andamento', 930)
on conflict (status_code) do update
set label = excluded.label,
    active = excluded.active,
    category = excluded.category,
    sort_order = excluded.sort_order;
