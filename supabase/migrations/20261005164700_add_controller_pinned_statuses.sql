insert into public.controller_status_options (status_code, label, active, category, sort_order)
values
  ('em_atendimento', 'Em atendimento', true, 'em_andamento', 120),
  ('paciente_aguardando', 'Paciente aguardando', true, 'em_andamento', 130),
  ('profissional_aguardando', 'Profissional aguardando', true, 'em_andamento', 140),
  ('sala_fechada', 'Sala fechada', true, 'em_andamento', 150)
on conflict (status_code) do update
set label = excluded.label,
    active = true,
    category = excluded.category,
    sort_order = excluded.sort_order;
