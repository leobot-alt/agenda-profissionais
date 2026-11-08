alter table public.controller_subpages
  add column if not exists operacao_key text null;

create index if not exists controller_subpages_operacao_key_idx
  on public.controller_subpages (operacao_key);
