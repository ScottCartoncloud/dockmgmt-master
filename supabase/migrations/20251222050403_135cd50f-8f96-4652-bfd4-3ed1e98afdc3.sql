-- Add RLS policy to allow public read access to carriers for booking link validation
-- Only exposes minimal data needed for public booking form

CREATE POLICY "Public can view enabled carriers by booking link"
ON public.carriers
FOR SELECT
USING (is_booking_link_enabled = true);