-- Habilita o status Acompanhando para os registros do Controller.
insert into public.controller_status_options (status_code, label, active, category, sort_order)
values ('acompanhando', 'Acompanhando', true, 'em_andamento', 110)
on conflict (status_code) do update
set label = excluded.label,
    active = true,
    category = excluded.category,
    sort_order = excluded.sort_order;
