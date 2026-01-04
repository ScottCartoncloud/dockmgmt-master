-- Add api_base_url column to cartoncloud_settings
-- Defaults to the primary CartonCloud API endpoint
ALTER TABLE public.cartoncloud_settings
ADD COLUMN api_base_url text NOT NULL DEFAULT 'https://api.cartoncloud.com';

-- Add check constraint for valid URLs
ALTER TABLE public.cartoncloud_settings
ADD CONSTRAINT cartoncloud_settings_api_base_url_check 
CHECK (
  api_base_url ~ '^https://(api\.cartoncloud\.com|api\.na\.cartoncloud\.com)$'
  OR api_base_url ~ '^https://[a-zA-Z0-9][a-zA-Z0-9\-\.]*\.[a-zA-Z]{2,}$'
);

-- Recreate the safe view to include api_base_url
DROP VIEW IF EXISTS public.cartoncloud_settings_safe;

CREATE VIEW public.cartoncloud_settings_safe
WITH (security_invoker = true)
AS SELECT
    id,
    cartoncloud_tenant_id,
    tenant_id,
    is_active,
    api_base_url,
    created_at,
    updated_at,
    ((client_id IS NOT NULL) AND (client_secret IS NOT NULL)) AS has_credentials
FROM cartoncloud_settings;