-- Create carriers table
CREATE TABLE public.carriers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  booking_link_id UUID NOT NULL DEFAULT gen_random_uuid(),
  is_booking_link_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX idx_carriers_tenant_id ON public.carriers(tenant_id);
CREATE UNIQUE INDEX idx_carriers_booking_link_id ON public.carriers(booking_link_id);

-- Enable RLS
ALTER TABLE public.carriers ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view carriers in their tenant"
ON public.carriers FOR SELECT
USING (
  is_super_user(auth.uid()) OR 
  tenant_id = get_user_tenant_id(auth.uid())
);

CREATE POLICY "Operators and admins can insert carriers"
ON public.carriers FOR INSERT
WITH CHECK (
  is_super_user(auth.uid()) OR 
  (tenant_id = get_user_tenant_id(auth.uid()) AND 
   (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operator')))
);

CREATE POLICY "Operators and admins can update carriers"
ON public.carriers FOR UPDATE
USING (
  is_super_user(auth.uid()) OR 
  (tenant_id = get_user_tenant_id(auth.uid()) AND 
   (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operator')))
);

CREATE POLICY "Admins can delete carriers"
ON public.carriers FOR DELETE
USING (
  is_super_user(auth.uid()) OR 
  (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'admin'))
);

-- Add trigger for updated_at
CREATE TRIGGER update_carriers_updated_at
  BEFORE UPDATE ON public.carriers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();