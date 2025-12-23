-- Add timezone column to tenants table
ALTER TABLE public.tenants 
ADD COLUMN timezone TEXT DEFAULT 'UTC';

-- Create tenant_working_hours table
CREATE TABLE public.tenant_working_hours (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Sunday, 6=Saturday
  enabled BOOLEAN NOT NULL DEFAULT true,
  start_time TIME NOT NULL DEFAULT '08:00',
  end_time TIME NOT NULL DEFAULT '17:00',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, day_of_week)
);

-- Enable RLS
ALTER TABLE public.tenant_working_hours ENABLE ROW LEVEL SECURITY;

-- RLS policies for tenant_working_hours
CREATE POLICY "Users can view working hours in their tenant"
ON public.tenant_working_hours
FOR SELECT
USING (
  is_super_user(auth.uid()) OR 
  tenant_id = get_user_tenant_id(auth.uid())
);

CREATE POLICY "Admins can insert working hours"
ON public.tenant_working_hours
FOR INSERT
WITH CHECK (
  is_super_user(auth.uid()) OR 
  (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'admin'))
);

CREATE POLICY "Admins can update working hours"
ON public.tenant_working_hours
FOR UPDATE
USING (
  is_super_user(auth.uid()) OR 
  (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'admin'))
);

CREATE POLICY "Admins can delete working hours"
ON public.tenant_working_hours
FOR DELETE
USING (
  is_super_user(auth.uid()) OR 
  (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'admin'))
);

-- Trigger for updated_at
CREATE TRIGGER update_tenant_working_hours_updated_at
BEFORE UPDATE ON public.tenant_working_hours
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();