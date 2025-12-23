-- Drop the existing view and recreate with SECURITY INVOKER
DROP VIEW IF EXISTS public.carriers_public;

-- Create the view with SECURITY INVOKER (uses caller's permissions)
CREATE VIEW public.carriers_public 
WITH (security_invoker = true)
AS
SELECT 
  id,
  tenant_id,
  name,
  booking_link_id,
  is_booking_link_enabled,
  created_at,
  updated_at
FROM public.carriers
WHERE is_booking_link_enabled = true;

-- Grant SELECT on the view to anon and authenticated roles
GRANT SELECT ON public.carriers_public TO anon;
GRANT SELECT ON public.carriers_public TO authenticated;

-- Add a policy to allow public access to the carriers table but ONLY via the view
-- This replaces the old overly permissive policy
CREATE POLICY "Public can view enabled carriers via view" 
ON public.carriers 
FOR SELECT 
TO anon
USING (is_booking_link_enabled = true);