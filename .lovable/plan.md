

## Problem

For short bookings (e.g. 30 min), the card height is too small to show the title and time on separate lines, causing info to get clipped.

## Solution

Condense the card layout for short bookings:
1. **Detect short bookings** — calculate duration, and if ≤ 30 min, use a single-line condensed layout showing title + time inline
2. **Show full details on hover via tooltip** — wrap the card content in a tooltip that shows all info (title, time, carrier, pallets, PO) when hovered

### Changes to `src/components/DraggableBookingCard.tsx`

- Calculate booking duration from `startTime`/`endTime`
- If duration ≤ 30 min (and not compact mode), render a **single-line layout**: title and time on the same row, truncated
- Wrap the entire card in a `Tooltip` that shows the full booking details (title, time range, carrier, pallets, PO reference) on hover
- Keep the existing multi-line layout for bookings > 30 min unchanged

Example condensed layout:
```
Container 123 · 08:00 - 08:30
```

The tooltip on hover would show:
```
Container 123
08:00 - 08:30
Carrier: UPS
3 pallets
```

This is a single-file change with no backend impact.

