-- Permite excluir uma escala junto com seus aceites e solicitações relacionadas.
-- A autorização continua restrita à gestão pelo RLS da tabela de escalas.

alter table public.escala_aceites
  drop constraint if exists escala_aceites_escala_id_fkey;

alter table public.escala_aceites
  add constraint escala_aceites_escala_id_fkey
  foreign key (escala_id)
  references public.escalas_mensais(id)
  on delete cascade;

alter table public.escala_solicitacoes
  drop constraint if exists escala_solicitacoes_escala_id_fkey;

alter table public.escala_solicitacoes
  add constraint escala_solicitacoes_escala_id_fkey
  foreign key (escala_id)
  references public.escalas_mensais(id)
  on delete cascade;

-- Necessário para que a gestão possa remover manualmente os aceites quando
-- uma escala é atualizada; a exclusão da escala também os remove em cascata.
drop policy if exists escalas_aceite_admin_delete on public.escala_aceites;

create policy escalas_aceite_admin_delete
  on public.escala_aceites
  for delete
  to authenticated
  using (private.is_rh_gestao());
