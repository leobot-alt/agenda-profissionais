-- A função valida auth.uid() internamente e não deve ser exposta ao papel anon.
revoke execute on function public.registrar_conferencia_agenda_dia(text, text, date, boolean) from anon;
revoke execute on function public.registrar_conferencia_agenda_dia(text, text, date, boolean) from public;
grant execute on function public.registrar_conferencia_agenda_dia(text, text, date, boolean) to authenticated;
