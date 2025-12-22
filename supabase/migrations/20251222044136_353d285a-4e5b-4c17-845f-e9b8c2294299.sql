-- Add carrier_id and confirmation_email to bookings table
ALTER TABLE public.bookings 
ADD COLUMN carrier_id UUID REFERENCES public.carriers(id) ON DELETE SET NULL,
ADD COLUMN confirmation_email TEXT;

-- Create index for carrier lookups
CREATE INDEX idx_bookings_carrier_id ON public.bookings(carrier_id);

-- Create RLS policy to allow public inserts via carrier booking links
-- This is for unauthenticated carrier bookings
CREATE POLICY "Public can insert bookings via carrier link"
ON public.bookings FOR INSERT
WITH CHECK (
  carrier_id IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM public.carriers 
    WHERE id = carrier_id 
    AND is_booking_link_enabled = true
  )
);