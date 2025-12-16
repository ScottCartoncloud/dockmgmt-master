-- Create table for CartonCloud integration settings
CREATE TABLE public.cartoncloud_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id TEXT NOT NULL,
  client_secret TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.cartoncloud_settings ENABLE ROW LEVEL SECURITY;

-- Create policies for access (admin-only in production, but public for MVP)
CREATE POLICY "Allow public read access to cartoncloud_settings" 
ON public.cartoncloud_settings 
FOR SELECT 
USING (true);

CREATE POLICY "Allow public insert access to cartoncloud_settings" 
ON public.cartoncloud_settings 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow public update access to cartoncloud_settings" 
ON public.cartoncloud_settings 
FOR UPDATE 
USING (true);

CREATE POLICY "Allow public delete access to cartoncloud_settings" 
ON public.cartoncloud_settings 
FOR DELETE 
USING (true);

-- Add trigger for automatic timestamp updates
CREATE TRIGGER update_cartoncloud_settings_updated_at
BEFORE UPDATE ON public.cartoncloud_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();