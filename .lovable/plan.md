

## Plan: Add Inbound/Outbound Toggle to Booking Modal

### 1. Database Migration
Add `sales_order_id` (text, nullable) and `cartoncloud_so` (jsonb, nullable) columns to the `bookings` table. The `bookings` table currently has no such columns.

### 2. Edge Function — `supabase/functions/cartoncloud/index.ts`
- Add `searchOutboundOrders` function mirroring `searchInboundOrders` but calling `outbound-orders/search`. No ALLOCATED status filtering.
- Register `search-outbound-orders` action in the router (after the existing `search-orders` block around line 642). Format results with `deliveryDate` from `details.deliver.requiredDate`.

### 3. Types — `src/types/booking.ts`
- Add `CartonCloudSO` interface: `id, reference, customer, status, deliveryDate, itemCount, warehouseName, numericId`.
- Add optional `salesOrderId?: string` and `cartonCloudSO?: CartonCloudSO` to `CrossDockBooking`.

### 4. Hook — `src/hooks/useCartonCloudSettings.ts`
- Add `CartonCloudSO` type (matching the interface).
- Add `useSearchCartonCloudSOs` hook mirroring `useSearchCartonCloudOrders` but with `action: 'search-outbound-orders'` and return type `CartonCloudSO[]`.

### 5. Booking Modal — `src/components/BookingModal.tsx`
- Add `orderType` state (`'inbound' | 'outbound'`, default `'inbound'`).
- Add Inbound/Outbound toggle at the top of the form using a two-button toggle group (matching existing UI patterns).
- When `inbound`: show existing PO search UI unchanged.
- When `outbound`: show mirrored SO search UI using `useSearchCartonCloudSOs`. Display `SO: {reference}`, `deliveryDate` instead of `arrivalDate`.
- Switching toggle clears the non-active linked order.
- On submit: populate `purchaseOrderId`/`cartonCloudPO` when inbound, `salesOrderId`/`cartonCloudSO` when outbound.
- When editing, detect which type was saved and set `orderType` accordingly.

### 6. Persistence — `src/hooks/useBookings.ts`
- In `rowToBooking`: map `sales_order_id` and `cartoncloud_so` to the new `CrossDockBooking` fields.
- In `useCreateBooking`: persist `sales_order_id` and `cartoncloud_so` from the booking object.
- In `useUpdateBooking`: handle the new fields in `updateData`.

### Technical Details
- Migration SQL: `ALTER TABLE bookings ADD COLUMN sales_order_id text, ADD COLUMN cartoncloud_so jsonb;`
- The outbound search endpoint is `POST /tenants/{tenantId}/outbound-orders/search` with the same search payload structure.
- No changes to RLS policies needed — existing policies cover the new columns.
- All existing PO behaviour remains untouched.

