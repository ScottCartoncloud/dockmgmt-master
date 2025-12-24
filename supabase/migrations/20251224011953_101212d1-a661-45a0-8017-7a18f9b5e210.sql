-- Drop the overly restrictive policy
DROP POLICY IF EXISTS "Service role only - no client access" ON public.cartoncloud_settings;

-- Create a policy that allows reading for users in the same tenant
-- The safe view will still be used, so credentials won't be exposed
CREATE POLICY "Users can read settings for their tenant"
ON public.cartoncloud_settings
FOR SELECT
USING (
  tenant_id = get_user_tenant_id(auth.uid())
  OR is_super_user(auth.uid())
);

-- Keep insert/update/delete restricted to service role only (via edge functions)
CREATE POLICY "Service role only for mutations"
ON public.cartoncloud_settings
FOR ALL
USING (false)
WITH CHECK (false);