drop policy if exists recibos_recebidos_insert_professional_managers
  on public.recibos_recebidos;
create policy recibos_recebidos_insert_professional_managers
  on public.recibos_recebidos
  for insert to authenticated
  with check (
    private.current_rh_has_permission('banco_profissionais_editar')
    and updated_by = auth.uid()
  );

drop policy if exists recibos_recebidos_update_professional_managers
  on public.recibos_recebidos;
create policy recibos_recebidos_update_professional_managers
  on public.recibos_recebidos
  for update to authenticated
  using (private.current_rh_has_permission('banco_profissionais_editar'))
  with check (
    private.current_rh_has_permission('banco_profissionais_editar')
    and updated_by = auth.uid()
  );
