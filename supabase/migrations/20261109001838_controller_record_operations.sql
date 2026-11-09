alter table public.controller_page_records
  add column if not exists operacao_key text null;

update public.controller_page_records as record
set operacao_key = page.operacao_key
from public.controller_subpages as page
where record.page_id = page.id
  and record.operacao_key is null
  and page.operacao_key is not null;

create index if not exists controller_page_records_operacao_key_idx
  on public.controller_page_records (operacao_key);
