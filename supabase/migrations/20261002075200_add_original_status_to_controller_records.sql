alter table public.controller_page_records
  add column if not exists status_original text not null default 'pendente';

update public.controller_page_records
set status_original = coalesce(nullif(status_original, ''), coalesce(nullif(status, ''), 'pendente'))
where status_original is null or status_original = '';
