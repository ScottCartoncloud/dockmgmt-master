-- Fix CartonCloud safe view for security_invoker while keeping credential columns inaccessible

-- 1) Create a SECURITY DEFINER helper to compute has_credentials without granting access to credential columns
CREATE OR REPLACE FUNCTION public.cartoncloud_settings_has_credentials(_settings_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (client_id IS NOT NULL AND client_secret IS NOT NULL)
  FROM public.cartoncloud_settings
  WHERE id = _settings_id
$$;

-- 2) Recreate view to avoid directly referencing client_id/client_secret
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
  public.cartoncloud_settings_has_credentials(id) AS has_credentials
FROM public.cartoncloud_settings;

-- 3) Grant authenticated users access only to NON-sensitive columns on base table
--    (Required because security_invoker views check invoker privileges on underlying objects.)
REVOKE ALL ON public.cartoncloud_settings FROM anon, authenticated;

GRANT SELECT (
  id,
  cartoncloud_tenant_id,
  tenant_id,
  is_active,
  api_base_url,
  created_at,
  updated_at
) ON public.cartoncloud_settings TO authenticated;