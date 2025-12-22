-- Add pallets column to bookings table
ALTER TABLE public.bookings ADD COLUMN pallets INTEGER DEFAULT NULL;

-- Add check constraint (using a constraint name for clarity)
ALTER TABLE public.bookings ADD CONSTRAINT bookings_pallets_check CHECK (pallets >= 0);