import { CrossDockBooking } from '@/types/booking';

interface BookingPosition {
  booking: CrossDockBooking;
  column: number;
  totalColumns: number;
}

/**
 * Calculates the column layout for overlapping bookings
 * Returns each booking with its column index and total columns in its group
 */
export function calculateBookingLayout(bookings: CrossDockBooking[]): BookingPosition[] {
  if (bookings.length === 0) return [];
  
  // Parse time to minutes for easier comparison
  const parseTime = (time: string): number => {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  };
  
  // Sort bookings by start time, then by end time
  const sorted = [...bookings].sort((a, b) => {
    const startDiff = parseTime(a.startTime) - parseTime(b.startTime);
    if (startDiff !== 0) return startDiff;
    return parseTime(a.endTime) - parseTime(b.endTime);
  });
  
  // Find overlapping groups and assign columns
  const positions: BookingPosition[] = [];
  const columns: { endTime: number; booking: CrossDockBooking }[] = [];
  
  for (const booking of sorted) {
    const startTime = parseTime(booking.startTime);
    const endTime = parseTime(booking.endTime);
    
    // Find the first column that's free (ends before this booking starts)
    let assignedColumn = -1;
    for (let i = 0; i < columns.length; i++) {
      if (columns[i].endTime <= startTime) {
        assignedColumn = i;
        break;
      }
    }
    
    // If no free column, create a new one
    if (assignedColumn === -1) {
      assignedColumn = columns.length;
      columns.push({ endTime, booking });
    } else {
      columns[assignedColumn] = { endTime, booking };
    }
    
    positions.push({
      booking,
      column: assignedColumn,
      totalColumns: 0, // Will be calculated in second pass
    });
  }
  
  // Second pass: determine max columns for each overlapping group
  // Group bookings that overlap with each other
  const groups: BookingPosition[][] = [];
  let currentGroup: BookingPosition[] = [];
  let groupEndTime = 0;
  
  for (const pos of positions) {
    const startTime = parseTime(pos.booking.startTime);
    const endTime = parseTime(pos.booking.endTime);
    
    if (currentGroup.length === 0 || startTime < groupEndTime) {
      // Overlaps with current group
      currentGroup.push(pos);
      groupEndTime = Math.max(groupEndTime, endTime);
    } else {
      // Start new group
      if (currentGroup.length > 0) {
        groups.push(currentGroup);
      }
      currentGroup = [pos];
      groupEndTime = endTime;
    }
  }
  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }
  
  // Set totalColumns for each booking in its group
  for (const group of groups) {
    const maxColumn = Math.max(...group.map(p => p.column)) + 1;
    for (const pos of group) {
      pos.totalColumns = maxColumn;
    }
  }
  
  return positions;
}

/**
 * Gets CSS styles for a booking based on its layout position
 */
export function getBookingLayoutStyle(
  column: number,
  totalColumns: number,
  gap: number = 2
): { left: string; right: string } {
  if (totalColumns <= 1) {
    return { left: `${gap}px`, right: `${gap}px` };
  }

  const widthPercent = 100 / totalColumns;
  const leftPercent = column * widthPercent;
  const rightPercent = (totalColumns - column - 1) * widthPercent;

  return {
    left: `calc(${leftPercent}% + ${gap}px)`,
    right: `calc(${rightPercent}% + ${gap}px)`,
  };
}
