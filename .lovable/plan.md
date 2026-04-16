

## Plan: Add Notes Tooltip on Booking Card Hover

### What
Add a tooltip to all booking cards (not just short ones) that shows the `notes` field on hover with a slight delay. The tooltip will appear after ~400ms and display the booking notes.

### Changes

**File: `src/components/DraggableBookingCard.tsx`**

1. Change the existing `Tooltip` to always render `TooltipContent` (not just for short bookings), showing notes when available.
2. Update `TooltipProvider` delay from 300ms to 400ms for a natural hover feel.
3. The tooltip will show:
   - Notes text (primary content users requested)
   - For short bookings: also keep existing expanded details (carrier, pallets, PO/SO)
4. If a booking has no notes and isn't short, no tooltip appears (using conditional rendering).

### Technical approach
- Restructure the `TooltipContent` conditional: render it when `booking.notes` exists OR when `isShort` is true.
- Notes displayed in a subtle style below any existing tooltip content.
- Max width constrained to prevent overly wide tooltips; long notes will wrap.

