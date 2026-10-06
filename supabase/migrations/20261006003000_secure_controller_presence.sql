-- Presence is kept in private per-user Realtime channels.
-- A user can publish and read only their own channel; active ADM profiles may
-- read channels under this feature so leadership can monitor the roster.
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.aa_controller_presence_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuarios_rh AS user_profile
    WHERE user_profile.auth_user_id = auth.uid()
      AND user_profile.ativo IS TRUE
      AND user_profile.removido IS FALSE
      AND user_profile.perfil IN ('administrador', 'administrador_geral')
  );
$$;

REVOKE ALL ON FUNCTION public.aa_controller_presence_is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aa_controller_presence_is_admin() TO authenticated;

DROP POLICY IF EXISTS aa_rh_presence_read_self_or_admin ON realtime.messages;
CREATE POLICY aa_rh_presence_read_self_or_admin
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (
    realtime.topic() LIKE 'aa-rh-presence:%'
    AND (
      realtime.topic() = 'aa-rh-presence:' || auth.uid()::text
      OR public.aa_controller_presence_is_admin()
    )
  );

DROP POLICY IF EXISTS aa_rh_presence_publish_self ON realtime.messages;
CREATE POLICY aa_rh_presence_publish_self
  ON realtime.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    realtime.topic() = 'aa-rh-presence:' || auth.uid()::text
  );
