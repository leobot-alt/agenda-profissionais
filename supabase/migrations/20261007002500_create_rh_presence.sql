CREATE TABLE IF NOT EXISTS public.rh_presence (
  auth_user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  display_name text NOT NULL,
  profile text NOT NULL,
  current_page text NOT NULL DEFAULT 'Dashboard',
  last_seen timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rh_presence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rh_presence_select_self_or_admin ON public.rh_presence;
CREATE POLICY rh_presence_select_self_or_admin
  ON public.rh_presence FOR SELECT TO authenticated
  USING (
    auth_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.usuarios_rh AS u
      WHERE u.auth_user_id = auth.uid()
        AND u.ativo IS TRUE
        AND u.removido IS FALSE
        AND u.perfil IN ('administrador', 'administrador_geral')
    )
  );

DROP POLICY IF EXISTS rh_presence_insert_self ON public.rh_presence;
CREATE POLICY rh_presence_insert_self
  ON public.rh_presence FOR INSERT TO authenticated
  WITH CHECK (auth_user_id = auth.uid());

DROP POLICY IF EXISTS rh_presence_update_self ON public.rh_presence;
CREATE POLICY rh_presence_update_self
  ON public.rh_presence FOR UPDATE TO authenticated
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE ON public.rh_presence TO authenticated;
