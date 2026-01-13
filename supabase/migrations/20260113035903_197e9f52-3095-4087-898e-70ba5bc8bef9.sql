-- Drop and recreate the view with security_invoker = true
-- This ensures the view inherits RLS policies from the base table
DROP VIEW IF EXISTS public.cartoncloud_settings_safe;

CREATE VIEW public.cartoncloud_settings_safe 
WITH (security_invoker = true)
AS 
SELECT 
    id,
    cartoncloud_tenant_id,
    tenant_id,
    is_active,
    api_base_url,
    created_at,
    updated_at,
    ((client_id IS NOT NULL) AND (client_secret IS NOT NULL)) AS has_credentials
FROM public.cartoncloud_settings;

-- Drop existing SELECT policy that may be restrictive
DROP POLICY IF EXISTS "Users can read settings for their tenant" ON public.cartoncloud_settings;

-- Create PERMISSIVE SELECT policies for cartoncloud_settings table
-- Policy for admins to view settings in their tenant
CREATE POLICY "Admins can view cartoncloud settings in their tenant"
ON public.cartoncloud_settings
FOR SELECT
TO authenticated
USING (
    tenant_id = get_user_tenant_id(auth.uid()) 
    AND has_role(auth.uid(), 'admin'::app_role)
);

-- Policy for super users to view all settings
CREATE POLICY "Super users can view all cartoncloud settings"
ON public.cartoncloud_settings
FOR SELECT
TO authenticated
USING (is_super_user(auth.uid()));