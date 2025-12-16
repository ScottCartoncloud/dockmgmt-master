-- Create dock_doors table for dock configuration
CREATE TABLE public.dock_doors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3B82F6',
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security (public read/write for now, can be restricted later with auth)
ALTER TABLE public.dock_doors ENABLE ROW LEVEL SECURITY;

-- Allow public access for V1 (no auth required yet)
CREATE POLICY "Allow public read access to dock_doors"
ON public.dock_doors
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Allow public insert access to dock_doors"
ON public.dock_doors
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Allow public update access to dock_doors"
ON public.dock_doors
FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow public delete access to dock_doors"
ON public.dock_doors
FOR DELETE
TO anon, authenticated
USING (true);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_dock_doors_updated_at
BEFORE UPDATE ON public.dock_doors
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default dock doors
INSERT INTO public.dock_doors (name, color, sort_order) VALUES
  ('Dock 1', '#3B82F6', 1),
  ('Dock 2', '#10B981', 2),
  ('Dock 3', '#F59E0B', 3);