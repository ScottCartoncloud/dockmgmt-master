-- Remove the RLS policy that exposes carrier emails publicly
DROP POLICY IF EXISTS "Public can view enabled carriers via view" ON public.carriers;

-- Recreate carriers_public view WITHOUT security_invoker so it can be queried publicly
-- The view already excludes the email column
DROP VIEW IF EXISTS public.carriers_public;

CREATE VIEW public.carriers_public AS
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

-- Grant SELECT on the view to anonymous users
GRANT SELECT ON public.carriers_public TO anon;