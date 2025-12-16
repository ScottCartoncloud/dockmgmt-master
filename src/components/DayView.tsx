import { CrossDockBooking } from '@/types/booking';
import { HOURS } from '@/data/mockData';
import { DraggableBookingCard } from './DraggableBookingCard';
import { format, isSameDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { useState, useRef, DragEvent } from 'react';

const HOUR_HEIGHT = 80; // pixels per hour
const QUARTER_HEIGHT = HOUR_HEIGHT / 4; // 20px per 15 minutes
const START_HOUR = HOURS[0]?.hour || 6; // Calendar starts at this hour

interface DayViewProps {
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
  booking: CrossDockBooking;
}

export function DayView({ 
  date, 
  bookings, 
  onTimeSlotClick, 
  onBookingClick,
  onBookingMove,
  onBookingResize
}: DayViewProps) {
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null);
  const [draggingBooking, setDraggingBooking] = useState<CrossDockBooking | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const offsetMinutesRef = useRef<number>(0);
  
  const dayBookings = bookings.filter((b) => isSameDay(b.date, date));

  const isCurrentHour = (hour: number) => {
    const now = new Date();
    return isSameDay(date, now) && now.getHours() === hour;
  };

  // Calculate booking duration in pixels
  const getBookingDurationHeight = (booking: CrossDockBooking) => {
    const [startH, startM] = booking.startTime.split(':').map(Number);
    const [endH, endM] = booking.endTime.split(':').map(Number);
    const durationMinutes = (endH * 60 + endM) - (startH * 60 + startM);
    return Math.max((durationMinutes / 60) * HOUR_HEIGHT, 24);
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
    
    setDragPreview({
      topPosition,
      height,
      booking: draggingBooking,
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
      onBookingMove(booking, date, preciseDropHour, 0); // offset already applied
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
    const height = Math.max(endOffset - startOffset, 24);
    
    return {
      top: Math.max(0, startOffset),
      height,
    };
  };

  return (
    <div className="flex-1 overflow-auto">
      <div className="min-w-[500px]">
        {/* Day header */}
        <div className="sticky top-0 z-20 bg-card border-b border-border">
          <div className="flex">
            <div className="w-[60px] flex-shrink-0 p-2 border-r border-border" />
            <div className="flex-1 p-2 text-center">
              <div className="text-xs text-muted-foreground uppercase tracking-wide">
                {format(date, 'EEEE')}
              </div>
              <div className={cn(
                'text-2xl font-semibold mt-1 w-10 h-10 mx-auto flex items-center justify-center rounded-full',
                isSameDay(date, new Date()) && 'bg-accent text-accent-foreground'
              )}>
                {format(date, 'd')}
              </div>
            </div>
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

          {/* Calendar content area */}
          <div 
            ref={gridRef}
            className="flex-1 relative"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
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
                onClick={() => onTimeSlotClick(date, hour)}
              >
                {/* 15-minute tick marks */}
                <div className="absolute left-0 right-0 top-[25%] border-t border-dashed border-border/40" />
                <div className="absolute left-0 right-0 top-[50%] border-t border-dotted border-border/60" />
                <div className="absolute left-0 right-0 top-[75%] border-t border-dashed border-border/40" />
              </div>
            ))}

            {/* Drag preview ghost */}
            {dragPreview && (
              <div
                className="absolute left-1 right-1 pointer-events-none z-20 rounded-md border-2 border-dashed border-accent bg-accent/20 transition-all duration-75"
                style={{
                  top: dragPreview.topPosition,
                  height: dragPreview.height,
                }}
              >
                <div className="p-2 text-sm font-medium text-accent truncate">
                  {dragPreview.booking.title}
                </div>
              </div>
            )}

            {/* Bookings overlay - positioned absolutely */}
            <div className="absolute inset-0 pointer-events-none">
              {dayBookings.map((booking) => {
                const style = getBookingStyle(booking);
                const isDragging = draggingBooking?.id === booking.id;
                
                return (
                  <div
                    key={booking.id}
                    className={cn(
                      "absolute left-1 right-1 pointer-events-auto z-10",
                      isDragging && "opacity-30"
                    )}
                    style={{
                      top: style.top,
                      height: style.height,
                    }}
                  >
                    <DraggableBookingCard
                      booking={booking}
                      onClick={onBookingClick}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                      onResize={onBookingResize}
                      isDragging={isDragging}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
