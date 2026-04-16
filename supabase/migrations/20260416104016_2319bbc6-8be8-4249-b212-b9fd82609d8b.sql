-- Fix 1: Drop the anon booking INSERT policy (reCAPTCHA bypass)
-- Carrier bookings go through the carrier-booking edge function which uses service_role
DROP POLICY IF EXISTS "Public can insert bookings via carrier link" ON public.bookings;

-- Fix 2: Restrict audit_log INSERT to only the audit trigger function
-- Drop the overly permissive policy that allows any authenticated user to insert
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_log;