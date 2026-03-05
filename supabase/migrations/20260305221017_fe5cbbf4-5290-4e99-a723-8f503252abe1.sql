
-- Fix: Change all RESTRICTIVE SELECT policies to PERMISSIVE across all tables
-- PostgreSQL RLS requires at least one PERMISSIVE policy to grant any access.
-- Having only RESTRICTIVE policies means zero rows are ever returned.

-- TENANTS
DROP POLICY IF EXISTS "Users can view their own tenant" ON public.tenants;
CREATE POLICY "Users can view their own tenant" ON public.tenants
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (is_super_user(auth.uid()) OR is_user_in_tenant(auth.uid(), id));

DROP POLICY IF EXISTS "Admins can manage tenants" ON public.tenants;
CREATE POLICY "Admins can manage tenants" ON public.tenants
  AS PERMISSIVE FOR ALL TO authenticated
  USING (is_super_user(auth.uid()) OR (is_user_in_tenant(auth.uid(), id) AND has_role(auth.uid(), 'admin'::app_role)));

-- BOOKINGS
DROP POLICY IF EXISTS "Users can view bookings in their tenant" ON public.bookings;
CREATE POLICY "Users can view bookings in their tenant" ON public.bookings
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (is_super_user(auth.uid()) OR is_user_in_tenant(auth.uid(), tenant_id));

DROP POLICY IF EXISTS "Operators and admins can insert bookings" ON public.bookings;
CREATE POLICY "Operators and admins can insert bookings" ON public.bookings
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (is_super_user(auth.uid()) OR (is_user_in_tenant(auth.uid(), tenant_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operator'::app_role))));

DROP POLICY IF EXISTS "Operators and admins can update bookings" ON public.bookings;
CREATE POLICY "Operators and admins can update bookings" ON public.bookings
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (is_super_user(auth.uid()) OR (is_user_in_tenant(auth.uid(), tenant_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operator'::app_role))));

DROP POLICY IF EXISTS "Admins can delete bookings" ON public.bookings;
CREATE POLICY "Admins can delete bookings" ON public.bookings
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (is_super_user(auth.uid()) OR (is_user_in_tenant(auth.uid(), tenant_id) AND has_role(auth.uid(), 'admin'::app_role)));

DROP POLICY IF EXISTS "Public can insert bookings via carrier link" ON public.bookings;
CREATE POLICY "Public can insert bookings via carrier link" ON public.bookings
  AS PERMISSIVE FOR INSERT TO anon, authenticated
  WITH CHECK (carrier_id IS NOT NULL AND EXISTS (SELECT 1 FROM carriers WHERE carriers.id = bookings.carrier_id AND carriers.is_booking_link_enabled = true));

-- DOCK_DOORS
DROP POLICY IF EXISTS "Users can view dock_doors in their tenant" ON public.dock_doors;
CREATE POLICY "Users can view dock_doors in their tenant" ON public.dock_doors
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (is_super_user(auth.uid()) OR is_user_in_tenant(auth.uid(), tenant_id));

DROP POLICY IF EXISTS "Operators and admins can insert dock_doors" ON public.dock_doors;
CREATE POLICY "Operators and admins can insert dock_doors" ON public.dock_doors
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (is_super_user(auth.uid()) OR (is_user_in_tenant(auth.uid(), tenant_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operator'::app_role))));

DROP POLICY IF EXISTS "Operators and admins can update dock_doors" ON public.dock_doors;
CREATE POLICY "Operators and admins can update dock_doors" ON public.dock_doors
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (is_super_user(auth.uid()) OR (is_user_in_tenant(auth.uid(), tenant_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operator'::app_role))));

DROP POLICY IF EXISTS "Admins can delete dock_doors" ON public.dock_doors;
CREATE POLICY "Admins can delete dock_doors" ON public.dock_doors
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (is_super_user(auth.uid()) OR (is_user_in_tenant(auth.uid(), tenant_id) AND has_role(auth.uid(), 'admin'::app_role)));

-- CARRIERS
DROP POLICY IF EXISTS "Users can view carriers in their tenant" ON public.carriers;
CREATE POLICY "Users can view carriers in their tenant" ON public.carriers
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (is_super_user(auth.uid()) OR is_user_in_tenant(auth.uid(), tenant_id));

DROP POLICY IF EXISTS "Operators and admins can insert carriers" ON public.carriers;
CREATE POLICY "Operators and admins can insert carriers" ON public.carriers
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (is_super_user(auth.uid()) OR (is_user_in_tenant(auth.uid(), tenant_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operator'::app_role))));

DROP POLICY IF EXISTS "Operators and admins can update carriers" ON public.carriers;
CREATE POLICY "Operators and admins can update carriers" ON public.carriers
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (is_super_user(auth.uid()) OR (is_user_in_tenant(auth.uid(), tenant_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operator'::app_role))));

DROP POLICY IF EXISTS "Admins can delete carriers" ON public.carriers;
CREATE POLICY "Admins can delete carriers" ON public.carriers
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (is_super_user(auth.uid()) OR (is_user_in_tenant(auth.uid(), tenant_id) AND has_role(auth.uid(), 'admin'::app_role)));

-- CUSTOM_BOOKING_FIELDS
DROP POLICY IF EXISTS "Users can view custom_booking_fields in their tenant" ON public.custom_booking_fields;
CREATE POLICY "Users can view custom_booking_fields in their tenant" ON public.custom_booking_fields
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (is_super_user(auth.uid()) OR is_user_in_tenant(auth.uid(), tenant_id));

DROP POLICY IF EXISTS "Admins can insert custom_booking_fields" ON public.custom_booking_fields;
CREATE POLICY "Admins can insert custom_booking_fields" ON public.custom_booking_fields
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (is_super_user(auth.uid()) OR (is_user_in_tenant(auth.uid(), tenant_id) AND has_role(auth.uid(), 'admin'::app_role)));

DROP POLICY IF EXISTS "Admins can update custom_booking_fields" ON public.custom_booking_fields;
CREATE POLICY "Admins can update custom_booking_fields" ON public.custom_booking_fields
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (is_super_user(auth.uid()) OR (is_user_in_tenant(auth.uid(), tenant_id) AND has_role(auth.uid(), 'admin'::app_role)));

DROP POLICY IF EXISTS "Admins can delete custom_booking_fields" ON public.custom_booking_fields;
CREATE POLICY "Admins can delete custom_booking_fields" ON public.custom_booking_fields
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (is_super_user(auth.uid()) OR (is_user_in_tenant(auth.uid(), tenant_id) AND has_role(auth.uid(), 'admin'::app_role)));

-- TENANT_WORKING_HOURS
DROP POLICY IF EXISTS "Users can view working hours in their tenant" ON public.tenant_working_hours;
CREATE POLICY "Users can view working hours in their tenant" ON public.tenant_working_hours
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (is_super_user(auth.uid()) OR is_user_in_tenant(auth.uid(), tenant_id));

DROP POLICY IF EXISTS "Admins can insert working hours" ON public.tenant_working_hours;
CREATE POLICY "Admins can insert working hours" ON public.tenant_working_hours
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (is_super_user(auth.uid()) OR (is_user_in_tenant(auth.uid(), tenant_id) AND has_role(auth.uid(), 'admin'::app_role)));

DROP POLICY IF EXISTS "Admins can update working hours" ON public.tenant_working_hours;
CREATE POLICY "Admins can update working hours" ON public.tenant_working_hours
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (is_super_user(auth.uid()) OR (is_user_in_tenant(auth.uid(), tenant_id) AND has_role(auth.uid(), 'admin'::app_role)));

DROP POLICY IF EXISTS "Admins can delete working hours" ON public.tenant_working_hours;
CREATE POLICY "Admins can delete working hours" ON public.tenant_working_hours
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (is_super_user(auth.uid()) OR (is_user_in_tenant(auth.uid(), tenant_id) AND has_role(auth.uid(), 'admin'::app_role)));

-- CARTONCLOUD_SETTINGS
DROP POLICY IF EXISTS "Admins can view cartoncloud settings in their tenant" ON public.cartoncloud_settings;
CREATE POLICY "Admins can view cartoncloud settings in their tenant" ON public.cartoncloud_settings
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (is_super_user(auth.uid()) OR (is_user_in_tenant(auth.uid(), tenant_id) AND has_role(auth.uid(), 'admin'::app_role)));

DROP POLICY IF EXISTS "Service role only for insert" ON public.cartoncloud_settings;
CREATE POLICY "Service role only for insert" ON public.cartoncloud_settings
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (false);

DROP POLICY IF EXISTS "Service role only for update" ON public.cartoncloud_settings;
CREATE POLICY "Service role only for update" ON public.cartoncloud_settings
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Service role only for delete" ON public.cartoncloud_settings;
CREATE POLICY "Service role only for delete" ON public.cartoncloud_settings
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (false);

-- TENANT_INVITES
DROP POLICY IF EXISTS "Admins can manage invites for their tenant" ON public.tenant_invites;
CREATE POLICY "Admins can manage invites for their tenant" ON public.tenant_invites
  AS PERMISSIVE FOR ALL TO authenticated
  USING (is_super_user(auth.uid()) OR (is_user_in_tenant(auth.uid(), tenant_id) AND has_role(auth.uid(), 'admin'::app_role)));

-- PROFILES
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (id = auth.uid());

DROP POLICY IF EXISTS "Super users can view all profiles" ON public.profiles;
CREATE POLICY "Super users can view all profiles" ON public.profiles
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (is_super_user(auth.uid()));

DROP POLICY IF EXISTS "Admins can view all profiles in tenant" ON public.profiles;
CREATE POLICY "Admins can view all profiles in tenant" ON public.profiles
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (is_user_in_tenant(auth.uid(), tenant_id) AND has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (id = auth.uid());

DROP POLICY IF EXISTS "Super users can update all profiles" ON public.profiles;
CREATE POLICY "Super users can update all profiles" ON public.profiles
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (is_super_user(auth.uid()) OR (is_user_in_tenant(auth.uid(), tenant_id) AND has_role(auth.uid(), 'admin'::app_role)));

-- USER_ROLES
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
CREATE POLICY "Users can view own roles" ON public.user_roles
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can manage roles in their tenant" ON public.user_roles;
CREATE POLICY "Admins can manage roles in their tenant" ON public.user_roles
  AS PERMISSIVE FOR ALL TO authenticated
  USING (is_super_user(auth.uid()) OR (has_role(auth.uid(), 'admin'::app_role) AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = user_roles.user_id AND is_user_in_tenant(auth.uid(), p.tenant_id))));

-- USER_TENANTS
DROP POLICY IF EXISTS "Users can view own tenant enrollments" ON public.user_tenants;
CREATE POLICY "Users can view own tenant enrollments" ON public.user_tenants
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can view tenant enrollments in their tenant" ON public.user_tenants;
CREATE POLICY "Admins can view tenant enrollments in their tenant" ON public.user_tenants
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (is_super_user(auth.uid()) OR (is_user_in_tenant(auth.uid(), tenant_id) AND has_role(auth.uid(), 'admin'::app_role)));

DROP POLICY IF EXISTS "Admins can add users to their tenant" ON public.user_tenants;
CREATE POLICY "Admins can add users to their tenant" ON public.user_tenants
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (is_super_user(auth.uid()) OR (is_user_in_tenant(auth.uid(), tenant_id) AND has_role(auth.uid(), 'admin'::app_role)));

DROP POLICY IF EXISTS "Admins can remove users from their tenant" ON public.user_tenants;
CREATE POLICY "Admins can remove users from their tenant" ON public.user_tenants
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (is_super_user(auth.uid()) OR (is_user_in_tenant(auth.uid(), tenant_id) AND has_role(auth.uid(), 'admin'::app_role)));

-- AUDIT_LOG
DROP POLICY IF EXISTS "Admins can view tenant audit logs" ON public.audit_log;
CREATE POLICY "Admins can view tenant audit logs" ON public.audit_log
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (is_super_user(auth.uid()) OR (is_user_in_tenant(auth.uid(), tenant_id) AND has_role(auth.uid(), 'admin'::app_role)));

DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_log;
CREATE POLICY "System can insert audit logs" ON public.audit_log
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (true);
