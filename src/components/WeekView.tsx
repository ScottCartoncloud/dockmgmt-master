import { CrossDockBooking } from '@/types/booking';
import { HOURS } from '@/data/mockData';
import { DraggableBookingCard } from './DraggableBookingCard';
import { format, startOfWeek, addDays, isSameDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { useState, DragEvent } from 'react';

interface WeekViewProps {
  date: Date;
  bookings: CrossDockBooking[];
  onTimeSlotClick: (date: Date, hour: number) => void;
  onBookingClick: (booking: CrossDockBooking) => void;
  onBookingMove?: (booking: CrossDockBooking, newDate: Date, newHour: number) => void;
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

  const getBookingsForDayAndHour = (day: Date, hour: number) => {
    return bookings.filter((b) => {
      const startHour = parseInt(b.startTime.split(':')[0]);
      return isSameDay(b.date, day) && startHour === hour;
    });
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
    if (bookingData && onBookingMove) {
      const booking = JSON.parse(bookingData) as CrossDockBooking;
      onBookingMove(booking, day, hour);
    }
  };

  return (
    <div className="flex-1 overflow-auto">
      <div className="min-w-[900px]">
        {/* Week header */}
        <div className="sticky top-0 z-10 bg-card border-b border-border">
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

        {/* Time slots */}
        <div>
          {HOURS.map(({ hour, label }) => (
            <div key={hour} className="flex border-b border-border">
              <div className="w-[60px] flex-shrink-0 h-[60px] flex items-start justify-end pr-2 pt-1 text-xs text-muted-foreground border-r border-border">
                {label}
              </div>
              {weekDays.map((day) => {
                const slotBookings = getBookingsForDayAndHour(day, hour);
                const slotKey = getSlotKey(day, hour);
                const isDropTarget = dragOverSlot === slotKey;
                
                return (
                  <div
                    key={slotKey}
                    className={cn(
                      'flex-1 h-[60px] p-1 cursor-pointer transition-colors border-r border-border last:border-r-0 overflow-hidden',
                      isCurrentHour(day, hour) && 'bg-accent/5',
                      isDropTarget && 'bg-accent/20 ring-2 ring-accent ring-inset',
                      !isDropTarget && 'hover:bg-muted/50'
                    )}
                    onClick={() => onTimeSlotClick(day, hour)}
                    onDragOver={(e) => handleDragOver(e, day, hour)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, day, hour)}
                  >
                    <div className="space-y-1 overflow-y-auto max-h-full">
                      {slotBookings.map((booking) => (
                        <DraggableBookingCard
                          key={booking.id}
                          booking={booking}
                          onClick={onBookingClick}
                          onDragStart={setDraggingBooking}
                          onDragEnd={() => setDraggingBooking(null)}
                          onResize={onBookingResize}
                          compact
                          isDragging={draggingBooking?.id === booking.id}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
