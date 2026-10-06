-- Armazena uma cor hexadecimal por status, editável nas configurações do Controller.
alter table public.controller_status_options
  add column if not exists row_color text;

update public.controller_status_options
   set row_color = case when status_code = 'pendente' then '#FFFFFF' else '#E2F3E8' end
 where row_color is null;

alter table public.controller_status_options
  alter column row_color set default '#E2F3E8',
  alter column row_color set not null;

alter table public.controller_status_options
  add constraint controller_status_options_row_color_check
  check (row_color ~ '^#[0-9A-Fa-f]{6}$');
