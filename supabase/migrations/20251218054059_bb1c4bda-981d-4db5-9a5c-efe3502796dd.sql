-- Create bookings table with tenant isolation
CREATE TABLE public.bookings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  carrier TEXT,
  truck_rego TEXT,
  dock_door_id UUID REFERENCES public.dock_doors(id) ON DELETE SET NULL,
  purchase_order_id TEXT,
  purchase_order JSONB,
  cartoncloud_po JSONB,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'arrived', 'in_progress', 'completed', 'cancelled')),
  custom_fields JSONB DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for common queries
CREATE INDEX idx_bookings_tenant_id ON public.bookings(tenant_id);
CREATE INDEX idx_bookings_date ON public.bookings(date);
CREATE INDEX idx_bookings_dock_door_id ON public.bookings(dock_door_id);
CREATE INDEX idx_bookings_status ON public.bookings(status);

-- Enable Row Level Security
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access bookings in their tenant
CREATE POLICY "Users can view bookings in their tenant"
ON public.bookings
FOR SELECT
USING (
  is_super_user(auth.uid()) OR 
  tenant_id = get_user_tenant_id(auth.uid())
);

CREATE POLICY "Operators and admins can insert bookings"
ON public.bookings
FOR INSERT
WITH CHECK (
  is_super_user(auth.uid()) OR 
  (
    tenant_id = get_user_tenant_id(auth.uid()) AND 
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operator'::app_role))
  )
);

CREATE POLICY "Operators and admins can update bookings"
ON public.bookings
FOR UPDATE
USING (
  is_super_user(auth.uid()) OR 
  (
    tenant_id = get_user_tenant_id(auth.uid()) AND 
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operator'::app_role))
  )
);

CREATE POLICY "Admins can delete bookings"
ON public.bookings
FOR DELETE
USING (
  is_super_user(auth.uid()) OR 
  (
    tenant_id = get_user_tenant_id(auth.uid()) AND 
    has_role(auth.uid(), 'admin'::app_role)
  )
);

-- Add trigger for updated_at
CREATE TRIGGER update_bookings_updated_at
BEFORE UPDATE ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for bookings
ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;