import { CrossDockBooking } from '@/types/booking';
import { HOURS } from '@/lib/calendarConstants';
import { DraggableBookingCard } from './DraggableBookingCard';
import { format, startOfWeek, addDays, isSameDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { useState, useRef, DragEvent, useMemo } from 'react';
import { useDockDoors, DockDoor } from '@/hooks/useDockDoors';
import { calculateBookingLayout, getBookingLayoutStyle } from '@/lib/bookingLayout';

const HOUR_HEIGHT = 80; // pixels per hour
const START_HOUR = HOURS[0]?.hour || 6; // Calendar starts at this hour

interface WeekViewProps {
  date: Date;
  bookings: CrossDockBooking[];
  onTimeSlotClick: (date: Date, hour: number) => void;
  onBookingClick: (booking: CrossDockBooking) => void;
  onBookingMove?: (booking: CrossDockBooking, newDate: Date, newHour: number, offsetMinutes: number) => void;
  onBookingResize?: (booking: CrossDockBooking, newEndTime: string) => void;
}

interface DragPreview {
  topPosition: number;
  height: number;
  dayIndex: number;
  booking: CrossDockBooking;
}

export function WeekView({ 
  date, 
  bookings, 
  onTimeSlotClick, 
  onBookingClick,
  onBookingMove,
  onBookingResize
}: WeekViewProps) {
  const { data: dockDoors } = useDockDoors();
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null);
  const [draggingBooking, setDraggingBooking] = useState<CrossDockBooking | null>(null);
  const gridRefs = useRef<(HTMLDivElement | null)[]>([]);
  const offsetMinutesRef = useRef<number>(0);
  
  const activeDocks = dockDoors?.filter(d => d.is_active) || [];
  const weekStart = startOfWeek(date, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Get dock color for a booking based on its dock number
  const getDockColorForBooking = (booking: CrossDockBooking): string | undefined => {
    if (!booking.dockNumber) return undefined;
    const dock = activeDocks.find(d => 
      d.name.includes(booking.dockNumber!.toString()) || 
      parseInt(d.name.replace(/\D/g, ''), 10) === booking.dockNumber
    );
    return dock?.color;
  };

  const getBookingsForDay = (day: Date) => {
    return bookings.filter((b) => isSameDay(b.date, day));
  };

  // Calculate layout for each day's bookings
  const dayLayouts = useMemo(() => {
    const layouts = new Map<string, Map<string, { column: number; totalColumns: number }>>();
    
    weekDays.forEach(day => {
      const dayKey = day.toISOString();
      const dayBookings = getBookingsForDay(day);
      const positions = calculateBookingLayout(dayBookings);
      
      const bookingMap = new Map<string, { column: number; totalColumns: number }>();
      positions.forEach(pos => {
        bookingMap.set(pos.booking.id, { column: pos.column, totalColumns: pos.totalColumns });
      });
      
      layouts.set(dayKey, bookingMap);
    });
    
    return layouts;
  }, [bookings, weekDays]);

  const isCurrentHour = (day: Date, hour: number) => {
    const now = new Date();
    return isSameDay(day, now) && now.getHours() === hour;
  };

  // Calculate booking duration in pixels
  const getBookingDurationHeight = (booking: CrossDockBooking) => {
    const [startH, startM] = booking.startTime.split(':').map(Number);
    const [endH, endM] = booking.endTime.split(':').map(Number);
    const durationMinutes = (endH * 60 + endM) - (startH * 60 + startM);
    return Math.max((durationMinutes / 60) * HOUR_HEIGHT, 20);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>, dayIndex: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    const gridEl = gridRefs.current[dayIndex];
    if (!gridEl || !draggingBooking) return;
    
    const rect = gridEl.getBoundingClientRect();
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
    
    setDragPreview({
      topPosition,
      height,
      dayIndex,
      booking: draggingBooking,
    });
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>, dayIndex: number) => {
    const gridEl = gridRefs.current[dayIndex];
    if (!gridEl?.contains(e.relatedTarget as Node)) {
      // Check if moving to another day column
      const isMovingToAnotherDay = gridRefs.current.some((ref, idx) => 
        idx !== dayIndex && ref?.contains(e.relatedTarget as Node)
      );
      if (!isMovingToAnotherDay) {
        setDragPreview(null);
      }
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>, day: Date, dayIndex: number) => {
    e.preventDefault();
    
    const bookingData = e.dataTransfer.getData('bookingData');
    const offsetMinutes = parseInt(e.dataTransfer.getData('offsetMinutes') || '0', 10);
    
    const gridEl = gridRefs.current[dayIndex];
    if (bookingData && onBookingMove && gridEl) {
      const booking = JSON.parse(bookingData) as CrossDockBooking;
      
      const rect = gridEl.getBoundingClientRect();
      const yInGrid = e.clientY - rect.top;
      const rawMinutes = (yInGrid / HOUR_HEIGHT) * 60 + (START_HOUR * 60);
      const adjustedMinutes = rawMinutes - offsetMinutes;
      const snappedMinutes = Math.round(adjustedMinutes / 15) * 15;
      
      const preciseDropHour = snappedMinutes / 60;
      onBookingMove(booking, day, preciseDropHour, 0); // offset already applied
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

  // Calculate booking position and height based on time
  const getBookingStyle = (booking: CrossDockBooking) => {
    const [startHour, startMin] = booking.startTime.split(':').map(Number);
    const [endHour, endMin] = booking.endTime.split(':').map(Number);
    
    const startOffset = ((startHour - START_HOUR) * HOUR_HEIGHT) + (startMin / 60 * HOUR_HEIGHT);
    const endOffset = ((endHour - START_HOUR) * HOUR_HEIGHT) + (endMin / 60 * HOUR_HEIGHT);
    const height = Math.max(endOffset - startOffset, 20);
    
    return {
      top: Math.max(0, startOffset),
      height,
    };
  };

  return (
    <div className="flex-1 overflow-auto">
      <div className="min-w-[900px]">
        {/* Week header */}
        <div className="sticky top-0 z-20 bg-card border-b border-border">
          <div className="flex">
            <div className="w-[60px] flex-shrink-0 p-2 border-r border-border" />
            {weekDays.map((day) => (
              <div 
                key={day.toISOString()} 
                className="flex-1 p-2 text-center border-r border-border last:border-r-0"
              >
                <div className="text-xs text-muted-foreground uppercase tracking-wide">
                  {format(day, 'EEE')}
                </div>
                <div className={cn(
                  'text-lg font-semibold mt-1 w-8 h-8 mx-auto flex items-center justify-center rounded-full',
                  isSameDay(day, new Date()) && 'bg-accent text-accent-foreground'
                )}>
                  {format(day, 'd')}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Time grid with bookings overlay */}
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

          {/* Day columns */}
          {weekDays.map((day, dayIndex) => {
            const dayBookings = getBookingsForDay(day);
            
            return (
              <div 
                key={day.toISOString()} 
                ref={(el) => { gridRefs.current[dayIndex] = el; }}
                className="flex-1 relative border-r border-border last:border-r-0"
                onDragOver={(e) => handleDragOver(e, dayIndex)}
                onDragLeave={(e) => handleDragLeave(e, dayIndex)}
                onDrop={(e) => handleDrop(e, day, dayIndex)}
              >
                {/* Hour grid lines and click targets */}
                {HOURS.map(({ hour }) => (
                  <div
                    key={hour}
                    className={cn(
                      'border-b border-border cursor-pointer transition-colors relative',
                      isCurrentHour(day, hour) && 'bg-accent/5',
                      !dragPreview && 'hover:bg-muted/50'
                    )}
                    style={{ height: HOUR_HEIGHT }}
                    onClick={() => onTimeSlotClick(day, hour)}
                  >
                    {/* 15-minute tick marks */}
                    <div className="absolute left-0 right-0 top-[25%] border-t border-dashed border-border/40" />
                    <div className="absolute left-0 right-0 top-[50%] border-t border-dotted border-border/60" />
                    <div className="absolute left-0 right-0 top-[75%] border-t border-dashed border-border/40" />
                  </div>
                ))}

                {/* Drag preview ghost for this column */}
                {dragPreview && dragPreview.dayIndex === dayIndex && (
                  <div
                    className="absolute left-0.5 right-0.5 pointer-events-none z-20 rounded-md border-2 border-dashed border-accent bg-accent/20 transition-all duration-75"
                    style={{
                      top: dragPreview.topPosition,
                      height: dragPreview.height,
                    }}
                  >
                    <div className="p-1 text-xs font-medium text-accent truncate">
                      {dragPreview.booking.title}
                    </div>
                  </div>
                )}

                {/* Bookings overlay - positioned absolutely */}
                <div className="absolute inset-0 pointer-events-none">
                  {dayBookings.map((booking) => {
                    const style = getBookingStyle(booking);
                    const isDragging = draggingBooking?.id === booking.id;
                    const layout = dayLayouts.get(day.toISOString())?.get(booking.id);
                    const layoutStyle = layout
                      ? getBookingLayoutStyle(layout.column, layout.totalColumns, 2)
                      : { left: '2px', right: '2px' };

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
                          compact
                          isDragging={isDragging}
                          dockColor={getDockColorForBooking(booking)}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
