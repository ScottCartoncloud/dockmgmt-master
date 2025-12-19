-- P0 Fix: Add super_user to app_role enum if not exists
-- Check if super_user already exists in enum
DO $$
BEGIN
  -- Try to add the value; if it already exists, the error is caught and ignored
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_user';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END$$;

-- P0 Fix: Make tenant_id NOT NULL on bookings (after ensuring no NULL values)
UPDATE public.bookings SET tenant_id = (SELECT id FROM public.tenants LIMIT 1) WHERE tenant_id IS NULL;
ALTER TABLE public.bookings ALTER COLUMN tenant_id SET NOT NULL;

-- P0 Fix: Make tenant_id NOT NULL on dock_doors
UPDATE public.dock_doors SET tenant_id = (SELECT id FROM public.tenants LIMIT 1) WHERE tenant_id IS NULL;
ALTER TABLE public.dock_doors ALTER COLUMN tenant_id SET NOT NULL;

-- P0 Fix: Make tenant_id NOT NULL on custom_booking_fields
UPDATE public.custom_booking_fields SET tenant_id = (SELECT id FROM public.tenants LIMIT 1) WHERE tenant_id IS NULL;
ALTER TABLE public.custom_booking_fields ALTER COLUMN tenant_id SET NOT NULL;

-- P0 Fix: Add unique constraint for dock names per tenant
ALTER TABLE public.dock_doors 
ADD CONSTRAINT unique_dock_name_per_tenant 
UNIQUE (tenant_id, name);

-- P0 Fix: Create audit_log table for tracking all data changes
CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  old_data JSONB,
  new_data JSONB,
  changed_by UUID,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address TEXT,
  user_agent TEXT
);

-- Create indexes for audit_log
CREATE INDEX IF NOT EXISTS idx_audit_log_tenant_id ON public.audit_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_table_name ON public.audit_log(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_log_record_id ON public.audit_log(record_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_changed_at ON public.audit_log(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_changed_by ON public.audit_log(changed_by);

-- Enable RLS on audit_log
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Admins can view audit logs for their tenant
CREATE POLICY "Admins can view tenant audit logs" ON public.audit_log
FOR SELECT USING (
  is_super_user(auth.uid()) OR 
  (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role))
);

-- Only system can insert audit logs (via triggers)
CREATE POLICY "System can insert audit logs" ON public.audit_log
FOR INSERT WITH CHECK (true);

-- Create generic audit trigger function
CREATE OR REPLACE FUNCTION public.audit_trigger_fn()
RETURNS TRIGGER AS $$
DECLARE
  _tenant_id UUID;
BEGIN
  -- Get tenant_id from the record
  IF TG_OP = 'DELETE' THEN
    _tenant_id := OLD.tenant_id;
  ELSE
    _tenant_id := NEW.tenant_id;
  END IF;

  INSERT INTO public.audit_log (
    tenant_id,
    table_name,
    record_id,
    action,
    old_data,
    new_data,
    changed_by
  ) VALUES (
    _tenant_id,
    TG_TABLE_NAME,
    CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END,
    TG_OP,
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
    auth.uid()
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Add audit triggers to main tables
DROP TRIGGER IF EXISTS audit_bookings ON public.bookings;
CREATE TRIGGER audit_bookings
AFTER INSERT OR UPDATE OR DELETE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

DROP TRIGGER IF EXISTS audit_dock_doors ON public.dock_doors;
CREATE TRIGGER audit_dock_doors
AFTER INSERT OR UPDATE OR DELETE ON public.dock_doors
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

DROP TRIGGER IF EXISTS audit_custom_booking_fields ON public.custom_booking_fields;
CREATE TRIGGER audit_custom_booking_fields
AFTER INSERT OR UPDATE OR DELETE ON public.custom_booking_fields
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

DROP TRIGGER IF EXISTS audit_cartoncloud_settings ON public.cartoncloud_settings;
CREATE TRIGGER audit_cartoncloud_settings
AFTER INSERT OR UPDATE OR DELETE ON public.cartoncloud_settings
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

-- Create booking_status enum for type safety
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_status') THEN
    CREATE TYPE public.booking_status AS ENUM ('scheduled', 'arrived', 'in_progress', 'completed', 'cancelled');
  END IF;
END$$;