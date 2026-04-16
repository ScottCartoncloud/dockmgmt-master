

## Plan: Multi-Warehouse Support

### 1. Database Migration (single migration)

Create `warehouses` table with RLS policies, add `warehouse_id` to `dock_doors`, and backfill existing data:

```sql
-- Warehouses table
CREATE TABLE public.warehouses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  name text NOT NULL,
  cartoncloud_warehouse_id text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;

-- RLS: same pattern as dock_doors
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
```

### 2. New Hook — `src/hooks/useWarehouses.ts`

- `useWarehouses()` — fetches warehouses for `activeTenant`, exposes `warehouses`, `defaultWarehouse`, `isLoading`
- `useCreateWarehouse()`, `useUpdateWarehouse()`, `useDeleteWarehouse()`, `useSetDefaultWarehouse()` mutations
- Delete mutation checks if any docks reference the warehouse and blocks with toast error

### 3. Settings UI — New Warehouses Tab

- Add `Warehouses` tab to `src/pages/Settings.tsx` (with `Warehouse` icon)
- Create `src/components/settings/WarehouseManagement.tsx`:
  - List warehouses with name, CC warehouse ID, default badge
  - Add/edit dialog: Name + CartonCloud Warehouse ID (plain text, no API lookup)
  - Delete with confirmation (blocked if docks assigned)
  - "Set as Default" button per warehouse

### 4. Update Dock Configuration

- In `DockConfiguration.tsx`, add a required Warehouse dropdown to the create/edit dialog
- Pre-select the default warehouse on create
- Update `DockDoor` interface and hooks to include `warehouse_id`
- Show warehouse name in dock list items

### 5. Calendar Warehouse Filter

- Add `selectedWarehouseId` state to `src/pages/Index.tsx`
- Add warehouse selector dropdown to `CalendarHeader.tsx` (new prop)
- Default to the tenant's default warehouse on load
- Filter `dockDoors` passed to `DayView`/`WeekView` by selected warehouse
- Hide selector if tenant has only one warehouse
- Filter bookings to only show those assigned to docks in the selected warehouse

### 6. CartonCloud Warehouse ID Integration

- Update `DockDoor` interface to include `warehouse_id` and optionally the resolved `cartoncloud_warehouse_id` via a join or separate lookup
- No changes to the edge function needed now — the warehouse ID context is available client-side when needed

### Technical Details

- The `dock_doors` table currently uses `tenant_id` for RLS. Adding `warehouse_id` as a nullable FK is safe for existing data thanks to the backfill.
- No foreign key from `dock_doors.tenant_id` to `tenants` exists currently, so the backfill uses a simple join.
- The warehouse selector state in `Index.tsx` resets when tenant changes (existing tenant-switch reset pattern).

### Files to Create
- `src/hooks/useWarehouses.ts`
- `src/components/settings/WarehouseManagement.tsx`
- Migration SQL file

### Files to Modify
- `src/pages/Settings.tsx` — add Warehouses tab
- `src/hooks/useDockDoors.ts` — add `warehouse_id` to interface and mutations
- `src/components/settings/DockConfiguration.tsx` — add warehouse dropdown to form
- `src/pages/Index.tsx` — warehouse filter state, pass filtered docks
- `src/components/CalendarHeader.tsx` — warehouse selector dropdown

