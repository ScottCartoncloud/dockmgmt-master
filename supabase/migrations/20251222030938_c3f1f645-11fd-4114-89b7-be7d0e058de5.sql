-- Drop existing RLS policies on cartoncloud_settings
DROP POLICY IF EXISTS "Admins and super users can view cartoncloud_settings" ON public.cartoncloud_settings;
DROP POLICY IF EXISTS "Admins and super users can insert cartoncloud_settings" ON public.cartoncloud_settings;
DROP POLICY IF EXISTS "Admins and super users can update cartoncloud_settings" ON public.cartoncloud_settings;
DROP POLICY IF EXISTS "Admins and super users can delete cartoncloud_settings" ON public.cartoncloud_settings;

-- Create a view that hides sensitive columns for client-side access
-- This view shows only non-sensitive metadata
CREATE OR REPLACE VIEW public.cartoncloud_settings_safe AS
SELECT 
  id,
  cartoncloud_tenant_id,
  tenant_id,
  is_active,
  created_at,
  updated_at,
  -- Indicate credentials exist without exposing them
  CASE WHEN client_id IS NOT NULL AND client_secret IS NOT NULL THEN true ELSE false END as has_credentials
FROM public.cartoncloud_settings;

-- Enable RLS on the base table with restrictive policies
-- IMPORTANT: Block ALL direct client access to the base table
-- Only edge functions with service role can access it

-- No SELECT policy for regular users on base table (only service role via edge functions)
-- This prevents any client from seeing encrypted credentials

-- Allow service role only (edge functions) to insert/update/delete
-- Edge functions use service role key, not user JWT

-- Create a security definer function to check settings access
CREATE OR REPLACE FUNCTION public.can_access_tenant_settings(_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _tenant_id = get_user_tenant_id(auth.uid()) 
    AND (has_role(auth.uid(), 'admin') OR is_super_user(auth.uid()))
$$;

-- RLS policy for the safe view - admins can view non-sensitive data
ALTER VIEW public.cartoncloud_settings_safe SET (security_invoker = on);

-- Grant access to the safe view
GRANT SELECT ON public.cartoncloud_settings_safe TO authenticated;

-- Revoke direct table access from anon and authenticated
REVOKE ALL ON public.cartoncloud_settings FROM anon, authenticated;

-- Grant only to service_role (used by edge functions)
GRANT ALL ON public.cartoncloud_settings TO service_role;

-- Create new restrictive policies that block all client access
-- Only service_role can access the table directly
CREATE POLICY "Service role only - no client access" 
ON public.cartoncloud_settings 
FOR ALL 
USING (false)  -- Block all client access
WITH CHECK (false);

-- Add comment explaining security model
COMMENT ON TABLE public.cartoncloud_settings IS 
'Contains encrypted CartonCloud API credentials. Direct access blocked for all clients. 
Use cartoncloud_settings_safe view for metadata. 
Edge functions use service_role to access encrypted credentials server-side only.';