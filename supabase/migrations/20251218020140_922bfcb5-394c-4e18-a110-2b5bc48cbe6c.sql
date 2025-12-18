-- Drop existing policies
DROP POLICY IF EXISTS "Admins can insert cartoncloud_settings" ON public.cartoncloud_settings;
DROP POLICY IF EXISTS "Admins can update cartoncloud_settings" ON public.cartoncloud_settings;
DROP POLICY IF EXISTS "Admins can delete cartoncloud_settings" ON public.cartoncloud_settings;
DROP POLICY IF EXISTS "Users can view cartoncloud_settings in their tenant" ON public.cartoncloud_settings;

-- Create updated policies that include super users
CREATE POLICY "Users can view cartoncloud_settings in their tenant"
ON public.cartoncloud_settings
FOR SELECT
USING (
  is_super_user(auth.uid()) OR 
  tenant_id = get_user_tenant_id(auth.uid())
);

CREATE POLICY "Admins and super users can insert cartoncloud_settings"
ON public.cartoncloud_settings
FOR INSERT
WITH CHECK (
  is_super_user(auth.uid()) OR 
  (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role))
);

CREATE POLICY "Admins and super users can update cartoncloud_settings"
ON public.cartoncloud_settings
FOR UPDATE
USING (
  is_super_user(auth.uid()) OR 
  (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role))
);

CREATE POLICY "Admins and super users can delete cartoncloud_settings"
ON public.cartoncloud_settings
FOR DELETE
USING (
  is_super_user(auth.uid()) OR 
  (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role))
);