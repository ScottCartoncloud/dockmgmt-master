import { CrossDockBooking } from '@/types/booking';
import { HOURS } from '@/lib/calendarConstants';
import { DraggableBookingCard } from './DraggableBookingCard';
import { format, isSameDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { useState, useRef, DragEvent, useMemo } from 'react';
import { useDockDoors, DockDoor } from '@/hooks/useDockDoors';
import { Loader2 } from 'lucide-react';
import { calculateBookingLayout, getBookingLayoutStyle } from '@/lib/bookingLayout';

const HOUR_HEIGHT = 80; // pixels per hour
const QUARTER_HEIGHT = HOUR_HEIGHT / 4; // 20px per 15 minutes
const START_HOUR = HOURS[0]?.hour || 6; // Calendar starts at this hour
const MIN_DOCK_WIDTH = 180; // minimum width per dock column

interface DayViewProps {
  date: Date;
  bookings: CrossDockBooking[];
  onTimeSlotClick: (date: Date, hour: number, dockId?: string) => void;
  onBookingClick: (booking: CrossDockBooking) => void;
  onBookingMove?: (booking: CrossDockBooking, newDate: Date, newHour: number, offsetMinutes: number, newDockId?: string) => void;
  onBookingResize?: (booking: CrossDockBooking, newEndTime: string) => void;
}

interface DragPreview {
  topPosition: number;
  height: number;
  booking: CrossDockBooking;
  dockId: string | null;
}

export function DayView({ 
  date, 
  bookings, 
  onTimeSlotClick, 
  onBookingClick,
  onBookingMove,
  onBookingResize
}: DayViewProps) {
  const { data: dockDoors, isLoading: isLoadingDocks } = useDockDoors();
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null);
  const [draggingBooking, setDraggingBooking] = useState<CrossDockBooking | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const offsetMinutesRef = useRef<number>(0);
  
  const activeDocks = dockDoors?.filter(d => d.is_active) || [];
  const dayBookings = bookings.filter((b) => isSameDay(b.date, date));

  const isCurrentHour = (hour: number) => {
    const now = new Date();
    return isSameDay(date, now) && now.getHours() === hour;
  };

  // Get dock by ID or number
  const getDockForBooking = (booking: CrossDockBooking): DockDoor | null => {
    if (booking.dockNumber) {
      // Try to match by dock number (legacy support)
      const dock = activeDocks.find(d => d.name.includes(booking.dockNumber!.toString()));
      if (dock) return dock;
    }
    return null;
  };

  // Calculate booking duration in pixels
  const getBookingDurationHeight = (booking: CrossDockBooking) => {
    const [startH, startM] = booking.startTime.split(':').map(Number);
    const [endH, endM] = booking.endTime.split(':').map(Number);
    const durationMinutes = (endH * 60 + endM) - (startH * 60 + startM);
    return Math.max((durationMinutes / 60) * HOUR_HEIGHT, 32);
  };

  const getDockIdFromPosition = (clientX: number): string | null => {
    if (!gridRef.current || activeDocks.length === 0) return null;
    
    const rect = gridRef.current.getBoundingClientRect();
    const xInGrid = clientX - rect.left;
    const dockWidth = rect.width / activeDocks.length;
    const dockIndex = Math.floor(xInGrid / dockWidth);
    
    if (dockIndex >= 0 && dockIndex < activeDocks.length) {
      return activeDocks[dockIndex].id;
    }
    return null;
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    if (!gridRef.current || !draggingBooking) return;
    
    const rect = gridRef.current.getBoundingClientRect();
    const yInGrid = e.clientY - rect.top;
    
    // Calculate drop position accounting for click offset
    const rawMinutes = (yInGrid / HOUR_HEIGHT) * 60 + (START_HOUR * 60);
    const adjustedMinutes = rawMinutes - offsetMinutesRef.current;
    
    // Snap to 15-minute intervals
    const snappedMinutes = Math.round(adjustedMinutes / 15) * 15;
    const clampedMinutes = Math.max(START_HOUR * 60, Math.min(23 * 60 + 45, snappedMinutes));
    
    // Convert back to pixel position
    const topPosition = ((clampedMinutes - START_HOUR * 60) / 60) * HOUR_HEIGHT;
    const height = getBookingDurationHeight(draggingBooking);
    
    // Get which dock we're hovering over
    const dockId = getDockIdFromPosition(e.clientX);
    
    setDragPreview({
      topPosition,
      height,
      booking: draggingBooking,
      dockId,
    });
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    // Only clear if leaving the grid entirely
    if (!gridRef.current?.contains(e.relatedTarget as Node)) {
      setDragPreview(null);
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    
    const bookingData = e.dataTransfer.getData('bookingData');
    const offsetMinutes = parseInt(e.dataTransfer.getData('offsetMinutes') || '0', 10);
    
    if (bookingData && onBookingMove && gridRef.current) {
      const booking = JSON.parse(bookingData) as CrossDockBooking;
      
      const rect = gridRef.current.getBoundingClientRect();
      const yInGrid = e.clientY - rect.top;
      const rawMinutes = (yInGrid / HOUR_HEIGHT) * 60 + (START_HOUR * 60);
      const adjustedMinutes = rawMinutes - offsetMinutes;
      const snappedMinutes = Math.round(adjustedMinutes / 15) * 15;
      
      const preciseDropHour = snappedMinutes / 60;
      const dockId = getDockIdFromPosition(e.clientX);
      
      onBookingMove(booking, date, preciseDropHour, 0, dockId || undefined);
    }
    
    setDragPreview(null);
  };

  const handleDragStart = (booking: CrossDockBooking, offsetMinutes: number) => {
    setDraggingBooking(booking);
    offsetMinutesRef.current = offsetMinutes;
  };

  const handleDragEnd = () => {
    setDraggingBooking(null);
    setDragPreview(null);
    offsetMinutesRef.current = 0;
  };

  // Calculate booking position based on time
  const getBookingStyle = (booking: CrossDockBooking) => {
    const [startHour, startMin] = booking.startTime.split(':').map(Number);
    const [endHour, endMin] = booking.endTime.split(':').map(Number);
    
    const startOffset = ((startHour - START_HOUR) * HOUR_HEIGHT) + (startMin / 60 * HOUR_HEIGHT);
    const endOffset = ((endHour - START_HOUR) * HOUR_HEIGHT) + (endMin / 60 * HOUR_HEIGHT);
    const height = Math.max(endOffset - startOffset, 32);
    
    return {
      top: Math.max(0, startOffset),
      height,
    };
  };

  // Group bookings by dock
  const getBookingsForDock = (dock: DockDoor) => {
    return dayBookings.filter(booking => {
      // Match by dock number
      if (booking.dockNumber) {
        const dockNum = parseInt(dock.name.replace(/\D/g, ''), 10);
        return booking.dockNumber === dockNum || dock.name.includes(booking.dockNumber.toString());
      }
      return false;
    });
  };

  // Calculate layout for each dock's bookings
  const dockLayouts = useMemo(() => {
    const layouts = new Map<string, Map<string, { column: number; totalColumns: number }>>();
    
    activeDocks.forEach(dock => {
      const dockBookings = getBookingsForDock(dock);
      const positions = calculateBookingLayout(dockBookings);
      
      const bookingMap = new Map<string, { column: number; totalColumns: number }>();
      positions.forEach(pos => {
        bookingMap.set(pos.booking.id, { column: pos.column, totalColumns: pos.totalColumns });
      });
      
      layouts.set(dock.id, bookingMap);
    });
    
    return layouts;
  }, [dayBookings, activeDocks]);

  // Bookings without an assigned dock
  const unassignedBookings = dayBookings.filter(booking => !booking.dockNumber);

  if (isLoadingDocks) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (activeDocks.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <p className="text-lg font-medium">No dock doors configured</p>
          <p className="text-sm mt-1">Go to Settings → Dock Config to add dock doors.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      <div style={{ minWidth: Math.max(500, activeDocks.length * MIN_DOCK_WIDTH + 60) }}>
        {/* Header with dock columns */}
        <div className="sticky top-0 z-20 bg-card border-b border-border">
          <div className="flex">
            {/* Time column header */}
            <div className="w-[60px] flex-shrink-0 p-2 border-r border-border">
              <div className="text-xs text-muted-foreground text-center">
                {format(date, 'EEE')}
                <div className={cn(
                  'text-lg font-semibold mt-1 w-8 h-8 mx-auto flex items-center justify-center rounded-full',
                  isSameDay(date, new Date()) && 'bg-accent text-accent-foreground'
                )}>
                  {format(date, 'd')}
                </div>
              </div>
            </div>
            
            {/* Dock column headers */}
            {activeDocks.map((dock) => (
              <div
                key={dock.id}
                className="flex-1 p-3 border-r border-border last:border-r-0 text-center"
                style={{ minWidth: MIN_DOCK_WIDTH }}
              >
                <div className="flex items-center justify-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: dock.color }}
                  />
                  <span className="font-medium text-foreground">{dock.name}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Time grid with dock columns */}
        <div className="flex">
          {/* Time labels column */}
          <div className="w-[60px] flex-shrink-0 border-r border-border">
            {HOURS.map(({ hour, label }) => (
              <div 
                key={hour} 
                className="relative border-b border-border"
                style={{ height: HOUR_HEIGHT }}
              >
                <div className="absolute top-0 right-2 text-xs text-muted-foreground">
                  {label}
                </div>
                <div className="absolute top-[25%] right-2 text-[10px] text-muted-foreground/50">
                  :15
                </div>
                <div className="absolute top-[50%] right-2 text-[10px] text-muted-foreground/60">
                  :30
                </div>
                <div className="absolute top-[75%] right-2 text-[10px] text-muted-foreground/50">
                  :45
                </div>
              </div>
            ))}
          </div>

          {/* Dock columns grid */}
          <div 
            ref={gridRef}
            className="flex-1 flex relative"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {activeDocks.map((dock, dockIndex) => {
              const dockBookings = getBookingsForDock(dock);
              const dockNumber = parseInt(dock.name.replace(/\D/g, ''), 10) || dockIndex + 1;
              
              return (
                <div
                  key={dock.id}
                  className="flex-1 relative border-r border-border last:border-r-0"
                  style={{ minWidth: MIN_DOCK_WIDTH }}
                >
                  {/* Hour grid lines and click targets */}
                  {HOURS.map(({ hour }) => (
                    <div
                      key={hour}
                      className={cn(
                        'border-b border-border cursor-pointer transition-colors relative',
                        isCurrentHour(hour) && 'bg-accent/5',
                        !dragPreview && 'hover:bg-muted/50'
                      )}
                      style={{ height: HOUR_HEIGHT }}
                      onClick={() => onTimeSlotClick(date, hour, dock.id)}
                    >
                      {/* 15-minute tick marks */}
                      <div className="absolute left-0 right-0 top-[25%] border-t border-dashed border-border/40" />
                      <div className="absolute left-0 right-0 top-[50%] border-t border-dotted border-border/60" />
                      <div className="absolute left-0 right-0 top-[75%] border-t border-dashed border-border/40" />
                    </div>
                  ))}

                  {/* Bookings for this dock */}
                  <div className="absolute inset-0 pointer-events-none">
                    {dockBookings.map((booking) => {
                      const style = getBookingStyle(booking);
                      const isDragging = draggingBooking?.id === booking.id;
                      const layout = dockLayouts.get(dock.id)?.get(booking.id);
                      const layoutStyle = layout
                        ? getBookingLayoutStyle(layout.column, layout.totalColumns, 4)
                        : { left: '4px', right: '4px' };

                      return (
                        <div
                          key={booking.id}
                          className={cn(
                            "absolute pointer-events-auto z-10",
                            isDragging && "opacity-30"
                          )}
                          style={{
                            top: style.top,
                            height: style.height,
                            left: layoutStyle.left,
                            right: layoutStyle.right,
                          }}
                        >
                          <DraggableBookingCard
                            booking={booking}
                            onClick={onBookingClick}
                            onDragStart={handleDragStart}
                            onDragEnd={handleDragEnd}
                            onResize={onBookingResize}
                            isDragging={isDragging}
                            dockColor={dock.color}
                            showDockBadge={false}
                          />
                        </div>
                      );
                    })}
                  </div>

                  {/* Drag preview for this dock */}
                  {dragPreview && dragPreview.dockId === dock.id && (
                    <div
                      className="absolute left-1 right-1 pointer-events-none z-20 rounded-md border-2 border-dashed transition-all duration-75"
                      style={{
                        top: dragPreview.topPosition,
                        height: dragPreview.height,
                        borderColor: dock.color,
                        backgroundColor: `${dock.color}20`,
                      }}
                    >
                      <div className="p-2 text-sm font-medium truncate" style={{ color: dock.color }}>
                        {dragPreview.booking.title}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Unassigned bookings indicator */}
        {unassignedBookings.length > 0 && (
          <div className="sticky bottom-0 bg-warning/10 border-t border-warning/30 p-3">
            <div className="text-sm text-warning-foreground">
              <span className="font-medium">{unassignedBookings.length} booking(s)</span> without assigned dock:
              {unassignedBookings.slice(0, 3).map(b => (
                <button
                  key={b.id}
                  onClick={() => onBookingClick(b)}
                  className="ml-2 underline hover:no-underline"
                >
                  {b.title}
                </button>
              ))}
              {unassignedBookings.length > 3 && <span className="ml-1">and {unassignedBookings.length - 3} more...</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
