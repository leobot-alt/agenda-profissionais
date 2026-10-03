-- Pendente volta a ser o status inicial obrigatório; DISPONÍVEL continua ativo como opção.
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

alter table public.controller_page_records
  alter column status set default 'pendente';

insert into public.controller_status_options (status_code, label, active, category, sort_order)
values
  ('pendente', 'Pendente', true, 'pendente', 10),
  ('disponivel', 'DISPONÍVEL', true, 'pendente', 20),
  ('atendido', 'ATENDIDO', true, 'finalizado', 30),
  ('bloqueado', 'BLOQUEADO', true, 'em_andamento', 40),
  ('cancelado', 'CANCELADO', true, 'finalizado', 50),
  ('desmarcado', 'DESMARCADO', true, 'finalizado', 60),
  ('desmarcado_pro', 'DESMARCADO PRO', true, 'finalizado', 70),
  ('faltou', 'FALTOU', true, 'finalizado', 80),
  ('horario_reservado_lideranca', 'HORÁRIO RESERVADO/LIDERANÇA', true, 'em_andamento', 90),
  ('pro_faltou', 'PRO FALTOU', true, 'finalizado', 100),
  ('remanejar', 'REMANEJAR', true, 'em_andamento', 110),
  ('falta', 'Falta', false, 'finalizado', 910),
  ('remanejado', 'Remanejado', false, 'finalizado', 920),
  ('ajuste_necessario', 'Ajuste necessário', false, 'em_andamento', 930)
on conflict (status_code) do update
set label = excluded.label,
    active = excluded.active,
    category = excluded.category,
    sort_order = excluded.sort_order;
