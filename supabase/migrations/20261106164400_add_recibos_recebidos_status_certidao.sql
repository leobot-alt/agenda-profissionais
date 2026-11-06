alter table public.recibos_recebidos
  add column if not exists status_certidao text not null default 'pendente';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.recibos_recebidos'::regclass
      and conname = 'recibos_recebidos_status_certidao_valid'
  ) then
    alter table public.recibos_recebidos
      add constraint recibos_recebidos_status_certidao_valid
      check (status_certidao in ('enviado', 'coletado', 'nao_enviado', 'pendente'));
  end if;
end;
$$;

comment on column public.recibos_recebidos.status_certidao is
  'Status mensal da certidão por profissional; utiliza os mesmos valores do status de recibo.';
