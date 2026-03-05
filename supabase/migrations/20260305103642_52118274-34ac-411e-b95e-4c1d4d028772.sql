
-- Step 1: Create a security definer helper to check user_tenants membership
CREATE OR REPLACE FUNCTION public.is_user_in_tenant(_user_id uuid, _tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_tenants
    WHERE user_id = _user_id AND tenant_id = _tenant_id
  )
$$;

-- Step 2: Update can_access_tenant_settings to use new function
CREATE OR REPLACE FUNCTION public.can_access_tenant_settings(_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT is_user_in_tenant(auth.uid(), _tenant_id)
    AND (has_role(auth.uid(), 'admin') OR is_super_user(auth.uid()))
$$;

-- ============================================
-- BOOKINGS policies
-- ============================================
DROP POLICY IF EXISTS "Users can view bookings in their tenant" ON public.bookings;
CREATE POLICY "Users can view bookings in their tenant" ON public.bookings
AS RESTRICTIVE FOR SELECT TO authenticated
USING (is_super_user(auth.uid()) OR is_user_in_tenant(auth.uid(), tenant_id));

DROP POLICY IF EXISTS "Operators and admins can insert bookings" ON public.bookings;
CREATE POLICY "Operators and admins can insert bookings" ON public.bookings
AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (is_super_user(auth.uid()) OR (is_user_in_tenant(auth.uid(), tenant_id) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operator'))));

DROP POLICY IF EXISTS "Operators and admins can update bookings" ON public.bookings;
CREATE POLICY "Operators and admins can update bookings" ON public.bookings
AS RESTRICTIVE FOR UPDATE TO authenticated
USING (is_super_user(auth.uid()) OR (is_user_in_tenant(auth.uid(), tenant_id) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operator'))));

DROP POLICY IF EXISTS "Admins can delete bookings" ON public.bookings;
CREATE POLICY "Admins can delete bookings" ON public.bookings
AS RESTRICTIVE FOR DELETE TO authenticated
USING (is_super_user(auth.uid()) OR (is_user_in_tenant(auth.uid(), tenant_id) AND has_role(auth.uid(), 'admin')));

-- ============================================
-- DOCK_DOORS policies
-- ============================================
DROP POLICY IF EXISTS "Users can view dock_doors in their tenant" ON public.dock_doors;
CREATE POLICY "Users can view dock_doors in their tenant" ON public.dock_doors
AS RESTRICTIVE FOR SELECT TO authenticated
USING (is_super_user(auth.uid()) OR is_user_in_tenant(auth.uid(), tenant_id));

DROP POLICY IF EXISTS "Operators and admins can insert dock_doors" ON public.dock_doors;
CREATE POLICY "Operators and admins can insert dock_doors" ON public.dock_doors
AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (is_super_user(auth.uid()) OR (is_user_in_tenant(auth.uid(), tenant_id) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operator'))));

DROP POLICY IF EXISTS "Operators and admins can update dock_doors" ON public.dock_doors;
CREATE POLICY "Operators and admins can update dock_doors" ON public.dock_doors
AS RESTRICTIVE FOR UPDATE TO authenticated
USING (is_super_user(auth.uid()) OR (is_user_in_tenant(auth.uid(), tenant_id) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operator'))));

DROP POLICY IF EXISTS "Admins can delete dock_doors" ON public.dock_doors;
CREATE POLICY "Admins can delete dock_doors" ON public.dock_doors
AS RESTRICTIVE FOR DELETE TO authenticated
USING (is_super_user(auth.uid()) OR (is_user_in_tenant(auth.uid(), tenant_id) AND has_role(auth.uid(), 'admin')));

-- ============================================
-- CARRIERS policies
-- ============================================
DROP POLICY IF EXISTS "Users can view carriers in their tenant" ON public.carriers;
CREATE POLICY "Users can view carriers in their tenant" ON public.carriers
AS RESTRICTIVE FOR SELECT TO authenticated
USING (is_super_user(auth.uid()) OR is_user_in_tenant(auth.uid(), tenant_id));

DROP POLICY IF EXISTS "Operators and admins can insert carriers" ON public.carriers;
CREATE POLICY "Operators and admins can insert carriers" ON public.carriers
AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (is_super_user(auth.uid()) OR (is_user_in_tenant(auth.uid(), tenant_id) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operator'))));

DROP POLICY IF EXISTS "Operators and admins can update carriers" ON public.carriers;
CREATE POLICY "Operators and admins can update carriers" ON public.carriers
AS RESTRICTIVE FOR UPDATE TO authenticated
USING (is_super_user(auth.uid()) OR (is_user_in_tenant(auth.uid(), tenant_id) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operator'))));

DROP POLICY IF EXISTS "Admins can delete carriers" ON public.carriers;
CREATE POLICY "Admins can delete carriers" ON public.carriers
AS RESTRICTIVE FOR DELETE TO authenticated
USING (is_super_user(auth.uid()) OR (is_user_in_tenant(auth.uid(), tenant_id) AND has_role(auth.uid(), 'admin')));

-- ============================================
-- CUSTOM_BOOKING_FIELDS policies
-- ============================================
DROP POLICY IF EXISTS "Users can view custom_booking_fields in their tenant" ON public.custom_booking_fields;
CREATE POLICY "Users can view custom_booking_fields in their tenant" ON public.custom_booking_fields
AS RESTRICTIVE FOR SELECT TO authenticated
USING (is_super_user(auth.uid()) OR is_user_in_tenant(auth.uid(), tenant_id));

DROP POLICY IF EXISTS "Admins can insert custom_booking_fields" ON public.custom_booking_fields;
CREATE POLICY "Admins can insert custom_booking_fields" ON public.custom_booking_fields
AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (is_super_user(auth.uid()) OR (is_user_in_tenant(auth.uid(), tenant_id) AND has_role(auth.uid(), 'admin')));

DROP POLICY IF EXISTS "Admins can update custom_booking_fields" ON public.custom_booking_fields;
CREATE POLICY "Admins can update custom_booking_fields" ON public.custom_booking_fields
AS RESTRICTIVE FOR UPDATE TO authenticated
USING (is_super_user(auth.uid()) OR (is_user_in_tenant(auth.uid(), tenant_id) AND has_role(auth.uid(), 'admin')));

DROP POLICY IF EXISTS "Admins can delete custom_booking_fields" ON public.custom_booking_fields;
CREATE POLICY "Admins can delete custom_booking_fields" ON public.custom_booking_fields
AS RESTRICTIVE FOR DELETE TO authenticated
USING (is_super_user(auth.uid()) OR (is_user_in_tenant(auth.uid(), tenant_id) AND has_role(auth.uid(), 'admin')));

-- ============================================
-- TENANT_WORKING_HOURS policies
-- ============================================
DROP POLICY IF EXISTS "Users can view working hours in their tenant" ON public.tenant_working_hours;
CREATE POLICY "Users can view working hours in their tenant" ON public.tenant_working_hours
AS RESTRICTIVE FOR SELECT TO authenticated
USING (is_super_user(auth.uid()) OR is_user_in_tenant(auth.uid(), tenant_id));

DROP POLICY IF EXISTS "Admins can insert working hours" ON public.tenant_working_hours;
CREATE POLICY "Admins can insert working hours" ON public.tenant_working_hours
AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (is_super_user(auth.uid()) OR (is_user_in_tenant(auth.uid(), tenant_id) AND has_role(auth.uid(), 'admin')));

DROP POLICY IF EXISTS "Admins can update working hours" ON public.tenant_working_hours;
CREATE POLICY "Admins can update working hours" ON public.tenant_working_hours
AS RESTRICTIVE FOR UPDATE TO authenticated
USING (is_super_user(auth.uid()) OR (is_user_in_tenant(auth.uid(), tenant_id) AND has_role(auth.uid(), 'admin')));

DROP POLICY IF EXISTS "Admins can delete working hours" ON public.tenant_working_hours;
CREATE POLICY "Admins can delete working hours" ON public.tenant_working_hours
AS RESTRICTIVE FOR DELETE TO authenticated
USING (is_super_user(auth.uid()) OR (is_user_in_tenant(auth.uid(), tenant_id) AND has_role(auth.uid(), 'admin')));

-- ============================================
-- CARTONCLOUD_SETTINGS policies (SELECT only)
-- ============================================
DROP POLICY IF EXISTS "Admins can view cartoncloud settings in their tenant" ON public.cartoncloud_settings;
DROP POLICY IF EXISTS "Super users can view all cartoncloud settings" ON public.cartoncloud_settings;
CREATE POLICY "Admins can view cartoncloud settings in their tenant" ON public.cartoncloud_settings
AS RESTRICTIVE FOR SELECT TO authenticated
USING (is_super_user(auth.uid()) OR (is_user_in_tenant(auth.uid(), tenant_id) AND has_role(auth.uid(), 'admin')));

-- ============================================
-- TENANT_INVITES policies
-- ============================================
DROP POLICY IF EXISTS "Admins can manage invites for their tenant" ON public.tenant_invites;
DROP POLICY IF EXISTS "Super users can manage all invites" ON public.tenant_invites;
CREATE POLICY "Admins can manage invites for their tenant" ON public.tenant_invites
AS RESTRICTIVE FOR ALL TO authenticated
USING (is_super_user(auth.uid()) OR (is_user_in_tenant(auth.uid(), tenant_id) AND has_role(auth.uid(), 'admin')));

-- ============================================
-- PROFILES policies
-- ============================================
DROP POLICY IF EXISTS "Admins can view all profiles in tenant" ON public.profiles;
CREATE POLICY "Admins can view all profiles in tenant" ON public.profiles
AS RESTRICTIVE FOR SELECT TO authenticated
USING (is_super_user(auth.uid()) OR (is_user_in_tenant(auth.uid(), tenant_id) AND has_role(auth.uid(), 'admin')));

DROP POLICY IF EXISTS "Super users can update all profiles" ON public.profiles;
CREATE POLICY "Super users can update all profiles" ON public.profiles
AS RESTRICTIVE FOR UPDATE TO authenticated
USING (is_super_user(auth.uid()) OR (is_user_in_tenant(auth.uid(), tenant_id) AND has_role(auth.uid(), 'admin')));

-- ============================================
-- USER_TENANTS policies
-- ============================================
DROP POLICY IF EXISTS "Admins can view tenant enrollments in their tenant" ON public.user_tenants;
CREATE POLICY "Admins can view tenant enrollments in their tenant" ON public.user_tenants
AS RESTRICTIVE FOR SELECT TO authenticated
USING (is_super_user(auth.uid()) OR (is_user_in_tenant(auth.uid(), tenant_id) AND has_role(auth.uid(), 'admin')));

DROP POLICY IF EXISTS "Admins can add users to their tenant" ON public.user_tenants;
CREATE POLICY "Admins can add users to their tenant" ON public.user_tenants
AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (is_super_user(auth.uid()) OR (is_user_in_tenant(auth.uid(), tenant_id) AND has_role(auth.uid(), 'admin')));

DROP POLICY IF EXISTS "Admins can remove users from their tenant" ON public.user_tenants;
CREATE POLICY "Admins can remove users from their tenant" ON public.user_tenants
AS RESTRICTIVE FOR DELETE TO authenticated
USING (is_super_user(auth.uid()) OR (is_user_in_tenant(auth.uid(), tenant_id) AND has_role(auth.uid(), 'admin')));

DROP POLICY IF EXISTS "Super users can manage all enrollments" ON public.user_tenants;

-- ============================================
-- USER_ROLES policies
-- ============================================
DROP POLICY IF EXISTS "Admins can manage roles in their tenant" ON public.user_roles;
DROP POLICY IF EXISTS "Super users can manage all roles" ON public.user_roles;
CREATE POLICY "Admins can manage roles in their tenant" ON public.user_roles
AS RESTRICTIVE FOR ALL TO authenticated
USING (
  is_super_user(auth.uid()) OR (
    has_role(auth.uid(), 'admin') AND
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = user_roles.user_id
      AND is_user_in_tenant(auth.uid(), p.tenant_id)
    )
  )
);

-- ============================================
-- TENANTS policies
-- ============================================
DROP POLICY IF EXISTS "Users can view their own tenant" ON public.tenants;
DROP POLICY IF EXISTS "Admins can manage tenants" ON public.tenants;
DROP POLICY IF EXISTS "Super users can manage all tenants" ON public.tenants;

CREATE POLICY "Users can view their own tenant" ON public.tenants
AS RESTRICTIVE FOR SELECT TO authenticated
USING (is_super_user(auth.uid()) OR is_user_in_tenant(auth.uid(), id));

CREATE POLICY "Admins can manage tenants" ON public.tenants
AS RESTRICTIVE FOR ALL TO authenticated
USING (is_super_user(auth.uid()) OR (is_user_in_tenant(auth.uid(), id) AND has_role(auth.uid(), 'admin')));

-- ============================================
-- AUDIT_LOG policies
-- ============================================
DROP POLICY IF EXISTS "Admins can view tenant audit logs" ON public.audit_log;
CREATE POLICY "Admins can view tenant audit logs" ON public.audit_log
AS RESTRICTIVE FOR SELECT TO authenticated
USING (is_super_user(auth.uid()) OR (is_user_in_tenant(auth.uid(), tenant_id) AND has_role(auth.uid(), 'admin')));
