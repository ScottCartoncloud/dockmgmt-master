
-- Fix profiles UPDATE policies: change from RESTRICTIVE to PERMISSIVE
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Super users can update all profiles" ON public.profiles;

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE TO authenticated
USING (id = auth.uid());

CREATE POLICY "Super users can update all profiles"
ON public.profiles FOR UPDATE TO authenticated
USING (is_super_user(auth.uid()));

-- Fix profiles SELECT policies: change from RESTRICTIVE to PERMISSIVE
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles in tenant" ON public.profiles;
DROP POLICY IF EXISTS "Super users can view all profiles" ON public.profiles;

CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT TO authenticated
USING (id = auth.uid());

CREATE POLICY "Admins can view all profiles in tenant"
ON public.profiles FOR SELECT TO authenticated
USING (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'admin'));

CREATE POLICY "Super users can view all profiles"
ON public.profiles FOR SELECT TO authenticated
USING (is_super_user(auth.uid()));

-- Fix user_roles policies: change from RESTRICTIVE to PERMISSIVE
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage roles in their tenant" ON public.user_roles;
DROP POLICY IF EXISTS "Super users can manage all roles" ON public.user_roles;

CREATE POLICY "Users can view own roles"
ON public.user_roles FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins can manage roles in their tenant"
ON public.user_roles FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = user_roles.user_id
    AND p.tenant_id = get_user_tenant_id(auth.uid())
  )
  AND has_role(auth.uid(), 'admin')
);

CREATE POLICY "Super users can manage all roles"
ON public.user_roles FOR ALL TO authenticated
USING (is_super_user(auth.uid()));
