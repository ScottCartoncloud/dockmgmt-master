
-- Step 1: Rename existing tenant_id in cartoncloud_settings to avoid conflict
ALTER TABLE public.cartoncloud_settings 
RENAME COLUMN tenant_id TO cartoncloud_tenant_id;

-- Step 2: Create app_role enum for role-based access
CREATE TYPE public.app_role AS ENUM ('admin', 'operator', 'viewer');

-- Step 3: Create tenants table
CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- Step 4: Create profiles table (links auth.users to tenants)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Step 5: Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Step 6: Create tenant_invites table for invite-only signup
CREATE TABLE public.tenant_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  email TEXT NOT NULL,
  role app_role NOT NULL DEFAULT 'viewer',
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '7 days'),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, email)
);

ALTER TABLE public.tenant_invites ENABLE ROW LEVEL SECURITY;

-- Step 7: Add tenant_id columns to existing tables (nullable for now)
ALTER TABLE public.dock_doors ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.custom_booking_fields ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.cartoncloud_settings ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

-- Step 8: Create default tenant and backfill existing data
INSERT INTO public.tenants (id, name) VALUES ('00000000-0000-0000-0000-000000000001', 'Default Tenant');

UPDATE public.dock_doors SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.custom_booking_fields SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.cartoncloud_settings SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;

-- Step 9: Create security definer function for role checks (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Step 10: Create function to get user's tenant_id
CREATE OR REPLACE FUNCTION public.get_user_tenant_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.profiles WHERE id = _user_id
$$;

-- Step 11: Create trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  invite_record RECORD;
BEGIN
  -- Check if user was invited
  SELECT * INTO invite_record 
  FROM public.tenant_invites 
  WHERE email = NEW.email 
    AND accepted_at IS NULL 
    AND expires_at > now()
  LIMIT 1;

  IF invite_record IS NOT NULL THEN
    -- Create profile with invited tenant
    INSERT INTO public.profiles (id, tenant_id, email, full_name)
    VALUES (NEW.id, invite_record.tenant_id, NEW.email, NEW.raw_user_meta_data->>'full_name');
    
    -- Assign invited role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, invite_record.role);
    
    -- Mark invite as accepted
    UPDATE public.tenant_invites SET accepted_at = now() WHERE id = invite_record.id;
  ELSE
    -- No invite: create profile without tenant (will need admin to assign)
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Step 12: Add updated_at triggers
CREATE TRIGGER update_tenants_updated_at
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Step 13: RLS Policies for tenants table
CREATE POLICY "Users can view their own tenant"
  ON public.tenants FOR SELECT
  USING (id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Admins can manage tenants"
  ON public.tenants FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Step 14: RLS Policies for profiles table
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid());

CREATE POLICY "Admins can view all profiles in tenant"
  ON public.profiles FOR SELECT
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'));

-- Step 15: RLS Policies for user_roles table
CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins can manage roles in their tenant"
  ON public.user_roles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = user_id 
        AND p.tenant_id = public.get_user_tenant_id(auth.uid())
    ) AND public.has_role(auth.uid(), 'admin')
  );

-- Step 16: RLS Policies for tenant_invites table
CREATE POLICY "Admins can manage invites for their tenant"
  ON public.tenant_invites FOR ALL
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'));

-- Step 17: Update existing table policies to be tenant-scoped
-- Drop old policies first
DROP POLICY IF EXISTS "Allow public read access to dock_doors" ON public.dock_doors;
DROP POLICY IF EXISTS "Allow public insert access to dock_doors" ON public.dock_doors;
DROP POLICY IF EXISTS "Allow public update access to dock_doors" ON public.dock_doors;
DROP POLICY IF EXISTS "Allow public delete access to dock_doors" ON public.dock_doors;

CREATE POLICY "Users can view dock_doors in their tenant"
  ON public.dock_doors FOR SELECT
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Operators and admins can insert dock_doors"
  ON public.dock_doors FOR INSERT
  WITH CHECK (
    tenant_id = public.get_user_tenant_id(auth.uid()) 
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operator'))
  );

CREATE POLICY "Operators and admins can update dock_doors"
  ON public.dock_doors FOR UPDATE
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid()) 
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operator'))
  );

CREATE POLICY "Admins can delete dock_doors"
  ON public.dock_doors FOR DELETE
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'));

-- Similar for custom_booking_fields
DROP POLICY IF EXISTS "Allow public read access to custom_booking_fields" ON public.custom_booking_fields;
DROP POLICY IF EXISTS "Allow public insert access to custom_booking_fields" ON public.custom_booking_fields;
DROP POLICY IF EXISTS "Allow public update access to custom_booking_fields" ON public.custom_booking_fields;
DROP POLICY IF EXISTS "Allow public delete access to custom_booking_fields" ON public.custom_booking_fields;

CREATE POLICY "Users can view custom_booking_fields in their tenant"
  ON public.custom_booking_fields FOR SELECT
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Admins can insert custom_booking_fields"
  ON public.custom_booking_fields FOR INSERT
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update custom_booking_fields"
  ON public.custom_booking_fields FOR UPDATE
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete custom_booking_fields"
  ON public.custom_booking_fields FOR DELETE
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'));

-- Similar for cartoncloud_settings
DROP POLICY IF EXISTS "Allow public read access to cartoncloud_settings" ON public.cartoncloud_settings;
DROP POLICY IF EXISTS "Allow public insert access to cartoncloud_settings" ON public.cartoncloud_settings;
DROP POLICY IF EXISTS "Allow public update access to cartoncloud_settings" ON public.cartoncloud_settings;
DROP POLICY IF EXISTS "Allow public delete access to cartoncloud_settings" ON public.cartoncloud_settings;

CREATE POLICY "Users can view cartoncloud_settings in their tenant"
  ON public.cartoncloud_settings FOR SELECT
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Admins can insert cartoncloud_settings"
  ON public.cartoncloud_settings FOR INSERT
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update cartoncloud_settings"
  ON public.cartoncloud_settings FOR UPDATE
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete cartoncloud_settings"
  ON public.cartoncloud_settings FOR DELETE
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'));
