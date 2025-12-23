-- Create a public view for carriers that excludes sensitive data (email)
CREATE OR REPLACE VIEW public.carriers_public AS
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

-- Drop the overly permissive public policy on carriers table
DROP POLICY IF EXISTS "Public can view enabled carriers by booking link" ON public.carriers;