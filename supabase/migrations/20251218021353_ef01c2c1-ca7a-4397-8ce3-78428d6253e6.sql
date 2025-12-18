-- Drop the existing SELECT policy
DROP POLICY IF EXISTS "Users can view cartoncloud_settings in their tenant" ON public.cartoncloud_settings;

-- Create new restricted SELECT policy for admins and super users only
CREATE POLICY "Admins and super users can view cartoncloud_settings"
ON public.cartoncloud_settings
FOR SELECT
USING (
  is_super_user(auth.uid()) OR 
  (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role))
);