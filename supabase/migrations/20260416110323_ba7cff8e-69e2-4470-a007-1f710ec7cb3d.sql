
-- Warehouses table
CREATE TABLE public.warehouses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  cartoncloud_warehouse_id text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view warehouses in their tenant" ON public.warehouses
  FOR SELECT TO authenticated
  USING (is_super_user(auth.uid()) OR is_user_in_tenant(auth.uid(), tenant_id));

CREATE POLICY "Admins can insert warehouses" ON public.warehouses
  FOR INSERT TO authenticated
  WITH CHECK (is_super_user(auth.uid()) OR (is_user_in_tenant(auth.uid(), tenant_id) AND has_role(auth.uid(), 'admin'::app_role)));

CREATE POLICY "Admins can update warehouses" ON public.warehouses
  FOR UPDATE TO authenticated
  USING (is_super_user(auth.uid()) OR (is_user_in_tenant(auth.uid(), tenant_id) AND has_role(auth.uid(), 'admin'::app_role)));

CREATE POLICY "Admins can delete warehouses" ON public.warehouses
  FOR DELETE TO authenticated
  USING (is_super_user(auth.uid()) OR (is_user_in_tenant(auth.uid(), tenant_id) AND has_role(auth.uid(), 'admin'::app_role)));

-- Add warehouse_id to dock_doors
ALTER TABLE public.dock_doors ADD COLUMN warehouse_id uuid REFERENCES public.warehouses(id);

-- Backfill: create default warehouse per tenant, assign existing docks
INSERT INTO public.warehouses (tenant_id, name, cartoncloud_warehouse_id, is_default)
SELECT DISTINCT tenant_id, 'Default Warehouse', 'default', true
FROM public.dock_doors WHERE tenant_id IS NOT NULL;

UPDATE public.dock_doors d
SET warehouse_id = w.id
FROM public.warehouses w
WHERE w.tenant_id = d.tenant_id AND w.is_default = true;

-- updated_at trigger
CREATE TRIGGER update_warehouses_updated_at
  BEFORE UPDATE ON public.warehouses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
