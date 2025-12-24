-- Fix CartonCloud safe view access without exposing credentials
-- Problem: cartoncloud_settings_safe is SECURITY INVOKER, but authenticated has no SELECT on cartoncloud_settings,
-- resulting in "permission denied for table cartoncloud_settings" and a blank UI.
-- Solution: Force RLS on base table and make the view run with definer privileges (no security_invoker),
-- while only granting SELECT on the safe view to authenticated users.

BEGIN;

-- Ensure RLS is enforced even for table owner (required when using definer views)
ALTER TABLE public.cartoncloud_settings FORCE ROW LEVEL SECURITY;

-- Recreate safe view WITHOUT security_invoker so it can read the base table without granting table access
DROP VIEW IF EXISTS public.cartoncloud_settings_safe;

CREATE VIEW public.cartoncloud_settings_safe AS
SELECT
  id,
  cartoncloud_tenant_id,
  tenant_id,
  is_active,
  created_at,
  updated_at,
  (client_id IS NOT NULL AND client_secret IS NOT NULL) AS has_credentials
FROM public.cartoncloud_settings;

-- Tighten privileges: authenticated can read the safe view; no public access.
REVOKE ALL ON public.cartoncloud_settings_safe FROM anon, authenticated;
GRANT SELECT ON public.cartoncloud_settings_safe TO authenticated;

-- Keep base table inaccessible from clients
REVOKE ALL ON public.cartoncloud_settings FROM anon, authenticated;

COMMIT;