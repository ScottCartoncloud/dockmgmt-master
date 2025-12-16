-- Create table for custom booking fields configuration
CREATE TABLE public.custom_booking_fields (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  label TEXT NOT NULL,
  field_type TEXT NOT NULL CHECK (field_type IN ('text', 'dropdown', 'multiselect', 'date')),
  is_required BOOLEAN NOT NULL DEFAULT false,
  options JSONB DEFAULT '[]'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.custom_booking_fields ENABLE ROW LEVEL SECURITY;

-- Create policies for access
CREATE POLICY "Allow public read access to custom_booking_fields" 
ON public.custom_booking_fields 
FOR SELECT 
USING (true);

CREATE POLICY "Allow public insert access to custom_booking_fields" 
ON public.custom_booking_fields 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow public update access to custom_booking_fields" 
ON public.custom_booking_fields 
FOR UPDATE 
USING (true);

CREATE POLICY "Allow public delete access to custom_booking_fields" 
ON public.custom_booking_fields 
FOR DELETE 
USING (true);

-- Add trigger for automatic timestamp updates
CREATE TRIGGER update_custom_booking_fields_updated_at
BEFORE UPDATE ON public.custom_booking_fields
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for ordering
CREATE INDEX idx_custom_booking_fields_sort_order ON public.custom_booking_fields(sort_order);