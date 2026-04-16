
ALTER TABLE public.cartoncloud_settings
  ADD COLUMN IF NOT EXISTS cartoncloud_tenant_slug text,
  ADD COLUMN IF NOT EXISTS cartoncloud_tenant_name text;

-- Recreate safe view to expose slug/name (non-sensitive)
DROP VIEW IF EXISTS public.cartoncloud_settings_safe;

CREATE VIEW public.cartoncloud_settings_safe
WITH (security_invoker = true) AS
SELECT
  id,
  tenant_id,
  cartoncloud_tenant_id,
  cartoncloud_tenant_slug,
  cartoncloud_tenant_name,
  api_base_url,
  is_active,
  created_at,
  updated_at,
  (client_id IS NOT NULL AND client_secret IS NOT NULL) AS has_credentials
FROM public.cartoncloud_settings;

GRANT SELECT ON public.cartoncloud_settings_safe TO authenticated;
