---
name: Multi-Warehouse Support
description: Warehouses table with dock assignment, calendar filtering, and Settings management UI
type: feature
---
- `warehouses` table: tenant_id, name, cartoncloud_warehouse_id, is_default
- `dock_doors` has `warehouse_id` FK to warehouses
- Calendar view filters docks/bookings by selected warehouse (hidden if only one warehouse)
- Settings > Warehouses tab for CRUD and setting default
- Dock create/edit requires warehouse selection
- Backfill migration creates "Default Warehouse" per tenant for existing docks
