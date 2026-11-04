alter table public.controller_page_records
  add column if not exists import_batch_id text;

comment on column public.controller_page_records.import_batch_id is
  'Identificador do lote de importação que criou o registro; NULL para registros anteriores ao rastreamento de lotes.';

create index if not exists controller_page_records_import_batch_owner_idx
  on public.controller_page_records (import_batch_id, criado_por)
  where import_batch_id is not null;
