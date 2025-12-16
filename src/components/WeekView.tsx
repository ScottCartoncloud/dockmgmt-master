import { CrossDockBooking } from '@/types/booking';
import { HOURS } from '@/data/mockData';
import { DraggableBookingCard } from './DraggableBookingCard';
import { format, startOfWeek, addDays, isSameDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { useState, DragEvent } from 'react';

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

export function WeekView({ 
  date, 
  bookings, 
  onTimeSlotClick, 
  onBookingClick,
  onBookingMove,
  onBookingResize
}: WeekViewProps) {
  const [dragOverSlot, setDragOverSlot] = useState<string | null>(null);
  const [draggingBooking, setDraggingBooking] = useState<CrossDockBooking | null>(null);
  
  const weekStart = startOfWeek(date, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const getBookingsForDay = (day: Date) => {
    return bookings.filter((b) => isSameDay(b.date, day));
  };

  const isCurrentHour = (day: Date, hour: number) => {
    const now = new Date();
    return isSameDay(day, now) && now.getHours() === hour;
  };

  const getSlotKey = (day: Date, hour: number) => `${day.toISOString()}-${hour}`;

  const handleDragOver = (e: DragEvent<HTMLDivElement>, day: Date, hour: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverSlot(getSlotKey(day, hour));
  };

  const handleDragLeave = () => {
    setDragOverSlot(null);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>, day: Date, hour: number) => {
    e.preventDefault();
    setDragOverSlot(null);
    
    const bookingData = e.dataTransfer.getData('bookingData');
    const offsetMinutes = parseInt(e.dataTransfer.getData('offsetMinutes') || '0', 10);
    
    if (bookingData && onBookingMove) {
      const booking = JSON.parse(bookingData) as CrossDockBooking;
      onBookingMove(booking, day, hour, offsetMinutes);
    }
  };

  // Calculate booking position and height based on time (accounting for calendar start hour)
  const getBookingStyle = (booking: CrossDockBooking) => {
    const [startHour, startMin] = booking.startTime.split(':').map(Number);
    const [endHour, endMin] = booking.endTime.split(':').map(Number);
    
    // Offset from the calendar start hour
    const startOffset = ((startHour - START_HOUR) * HOUR_HEIGHT) + (startMin / 60 * HOUR_HEIGHT);
    const endOffset = ((endHour - START_HOUR) * HOUR_HEIGHT) + (endMin / 60 * HOUR_HEIGHT);
    const height = Math.max(endOffset - startOffset, 20); // min height of 20px for compact view
    
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
                className="flex items-start justify-end pr-2 pt-1 text-xs text-muted-foreground border-b border-border"
                style={{ height: HOUR_HEIGHT }}
              >
                {label}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {weekDays.map((day) => {
            const dayBookings = getBookingsForDay(day);
            
            return (
              <div key={day.toISOString()} className="flex-1 relative border-r border-border last:border-r-0">
                {/* Hour grid lines and click targets */}
                {HOURS.map(({ hour }) => {
                  const slotKey = getSlotKey(day, hour);
                  const isDropTarget = dragOverSlot === slotKey;
                  
                  return (
                    <div
                      key={hour}
                      className={cn(
                        'border-b border-border cursor-pointer transition-colors',
                        isCurrentHour(day, hour) && 'bg-accent/5',
                        isDropTarget && 'bg-accent/20 ring-2 ring-accent ring-inset',
                        !isDropTarget && 'hover:bg-muted/50'
                      )}
                      style={{ height: HOUR_HEIGHT }}
                      onClick={() => onTimeSlotClick(day, hour)}
                      onDragOver={(e) => handleDragOver(e, day, hour)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, day, hour)}
                    />
                  );
                })}

                {/* Bookings overlay - positioned absolutely */}
                <div className="absolute inset-0 pointer-events-none">
                  {dayBookings.map((booking) => {
                    const style = getBookingStyle(booking);
                    return (
                      <div
                        key={booking.id}
                        className="absolute left-0.5 right-0.5 pointer-events-auto z-10"
                        style={{
                          top: style.top,
                          height: style.height,
                        }}
                      >
                        <DraggableBookingCard
                          booking={booking}
                          onClick={onBookingClick}
                          onDragStart={setDraggingBooking}
                          onDragEnd={() => setDraggingBooking(null)}
                          onResize={onBookingResize}
                          compact
                          isDragging={draggingBooking?.id === booking.id}
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
