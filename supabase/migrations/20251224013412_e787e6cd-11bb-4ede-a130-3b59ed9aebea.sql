-- Drop and recreate the view with security_invoker = true (default in PostgreSQL 15+)
-- This ensures the view uses the caller's permissions to access the underlying table
DROP VIEW IF EXISTS public.cartoncloud_settings_safe;

CREATE VIEW public.cartoncloud_settings_safe
WITH (security_invoker = true)
AS
SELECT 
    id,
    cartoncloud_tenant_id,
    tenant_id,
    is_active,
    created_at,
    updated_at,
    CASE WHEN (client_id IS NOT NULL AND client_secret IS NOT NULL) THEN true ELSE false END AS has_credentials
FROM public.cartoncloud_settings;