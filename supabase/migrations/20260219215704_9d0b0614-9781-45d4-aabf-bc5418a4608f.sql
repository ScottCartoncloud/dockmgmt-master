
-- Create user_tenants junction table for multi-tenant enrollment
CREATE TABLE public.user_tenants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, tenant_id)
);

-- Enable RLS
ALTER TABLE public.user_tenants ENABLE ROW LEVEL SECURITY;

-- Users can view their own tenant enrollments
CREATE POLICY "Users can view own tenant enrollments"
ON public.user_tenants FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- Admins can view enrollments for users in their tenant
CREATE POLICY "Admins can view tenant enrollments in their tenant"
ON public.user_tenants FOR SELECT TO authenticated
USING (
  tenant_id = get_user_tenant_id(auth.uid())
  AND has_role(auth.uid(), 'admin')
);

-- Super users can manage all enrollments
CREATE POLICY "Super users can manage all enrollments"
ON public.user_tenants FOR ALL TO authenticated
USING (is_super_user(auth.uid()));

-- Admins can add users to their own tenant
CREATE POLICY "Admins can add users to their tenant"
ON public.user_tenants FOR INSERT TO authenticated
WITH CHECK (
  tenant_id = get_user_tenant_id(auth.uid())
  AND has_role(auth.uid(), 'admin')
);

-- Admins can remove users from their own tenant
CREATE POLICY "Admins can remove users from their tenant"
ON public.user_tenants FOR DELETE TO authenticated
USING (
  tenant_id = get_user_tenant_id(auth.uid())
  AND has_role(auth.uid(), 'admin')
);

-- Seed existing enrollments from profiles.tenant_id
INSERT INTO public.user_tenants (user_id, tenant_id)
SELECT id, tenant_id FROM public.profiles
WHERE tenant_id IS NOT NULL
ON CONFLICT (user_id, tenant_id) DO NOTHING;

-- Add index for fast lookups
CREATE INDEX idx_user_tenants_user_id ON public.user_tenants(user_id);
CREATE INDEX idx_user_tenants_tenant_id ON public.user_tenants(tenant_id);
