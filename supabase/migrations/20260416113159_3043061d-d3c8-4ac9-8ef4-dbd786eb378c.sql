
CREATE OR REPLACE FUNCTION public.set_default_warehouse(_warehouse_id uuid, _tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify caller has access
  IF NOT (is_super_user(auth.uid()) OR (is_user_in_tenant(auth.uid(), _tenant_id) AND has_role(auth.uid(), 'admin'::app_role))) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Verify warehouse belongs to tenant
  IF NOT EXISTS (SELECT 1 FROM public.warehouses WHERE id = _warehouse_id AND tenant_id = _tenant_id) THEN
    RAISE EXCEPTION 'Warehouse not found in tenant';
  END IF;

  -- Atomic swap: unset all, then set new default
  UPDATE public.warehouses SET is_default = false WHERE tenant_id = _tenant_id AND is_default = true;
  UPDATE public.warehouses SET is_default = true WHERE id = _warehouse_id AND tenant_id = _tenant_id;
END;
$$;
