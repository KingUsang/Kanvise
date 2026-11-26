-- DEV-AVT-002: the original FOR ALL policy on avatar_configs matched
-- "user_id = auth.uid() OR school_id = current_user_school_id()", so any
-- signed-in member of an account could read, change and delete every avatar
-- in that account. It also compared the Profile UUID with the Auth UUID,
-- which never match.
--
-- Replace it with one policy per operation. Each policy limits access to the
-- caller's own avatar, resolved through user_profiles.supabase_auth_id, and
-- write policies also pin the row's school_id to that Profile's account.
--
-- The policies do not call public.current_user_school_id(). That function is
-- created in 20260706000001 but is missing on staging (schema drift, see
-- DEV-DB-018), so the account is read from the caller's own Profile row.
--
-- Table grants for anon/authenticated stay revoked (20260723130000). The
-- policies are defense in depth and apply only if direct access is restored.
-- No Admin override is added: the API (service_role) handles Admin changes.

DROP POLICY IF EXISTS "Users can view and manage their own avatar" ON public.avatar_configs;

CREATE POLICY "avatar_configs_select_own"
ON public.avatar_configs
FOR SELECT
TO authenticated
USING (
  user_id IN (
    SELECT profile.id FROM public.user_profiles AS profile
    WHERE profile.supabase_auth_id = (SELECT auth.uid())
  )
);

CREATE POLICY "avatar_configs_insert_own"
ON public.avatar_configs
FOR INSERT
TO authenticated
WITH CHECK (
  user_id IN (
    SELECT profile.id FROM public.user_profiles AS profile
    WHERE profile.supabase_auth_id = (SELECT auth.uid())
      AND profile.school_id = avatar_configs.school_id
  )
);

CREATE POLICY "avatar_configs_update_own"
ON public.avatar_configs
FOR UPDATE
TO authenticated
USING (
  user_id IN (
    SELECT profile.id FROM public.user_profiles AS profile
    WHERE profile.supabase_auth_id = (SELECT auth.uid())
  )
)
WITH CHECK (
  user_id IN (
    SELECT profile.id FROM public.user_profiles AS profile
    WHERE profile.supabase_auth_id = (SELECT auth.uid())
      AND profile.school_id = avatar_configs.school_id
  )
);

CREATE POLICY "avatar_configs_delete_own"
ON public.avatar_configs
FOR DELETE
TO authenticated
USING (
  user_id IN (
    SELECT profile.id FROM public.user_profiles AS profile
    WHERE profile.supabase_auth_id = (SELECT auth.uid())
  )
);
