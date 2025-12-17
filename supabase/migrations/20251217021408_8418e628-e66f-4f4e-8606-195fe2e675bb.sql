-- Create a function to check if user is super_user (for admin panel access)
CREATE OR REPLACE FUNCTION public.is_super_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'super_user'::app_role
  )
$$;

-- Update profiles RLS to allow super_users to view all profiles
DROP POLICY IF EXISTS "Super users can view all profiles" ON public.profiles;
CREATE POLICY "Super users can view all profiles"
ON public.profiles
FOR SELECT
USING (is_super_user(auth.uid()));

-- Allow super_users to update any profile
DROP POLICY IF EXISTS "Super users can update all profiles" ON public.profiles;
CREATE POLICY "Super users can update all profiles"
ON public.profiles
FOR UPDATE
USING (is_super_user(auth.uid()));

-- Update tenants RLS to allow super_users full access
DROP POLICY IF EXISTS "Super users can manage all tenants" ON public.tenants;
CREATE POLICY "Super users can manage all tenants"
ON public.tenants
FOR ALL
USING (is_super_user(auth.uid()));

-- Update user_roles RLS to allow super_users to manage all roles
DROP POLICY IF EXISTS "Super users can manage all roles" ON public.user_roles;
CREATE POLICY "Super users can manage all roles"
ON public.user_roles
FOR ALL
USING (is_super_user(auth.uid()));

-- Update tenant_invites RLS to allow super_users to manage all invites
DROP POLICY IF EXISTS "Super users can manage all invites" ON public.tenant_invites;
CREATE POLICY "Super users can manage all invites"
ON public.tenant_invites
FOR ALL
USING (is_super_user(auth.uid()));