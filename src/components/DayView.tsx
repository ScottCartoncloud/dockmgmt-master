import { CrossDockBooking } from '@/types/booking';
import { HOURS } from '@/data/mockData';
import { BookingCard } from './BookingCard';
import { format, isSameDay } from 'date-fns';
import { cn } from '@/lib/utils';

interface DayViewProps {
  date: Date;
  bookings: CrossDockBooking[];
  onTimeSlotClick: (date: Date, hour: number) => void;
  onBookingClick: (booking: CrossDockBooking) => void;
}

export function DayView({ date, bookings, onTimeSlotClick, onBookingClick }: DayViewProps) {
  const dayBookings = bookings.filter((b) => isSameDay(b.date, date));

  const getBookingsForHour = (hour: number) => {
    return dayBookings.filter((b) => {
      const startHour = parseInt(b.startTime.split(':')[0]);
      return startHour === hour;
    });
  };

  const isCurrentHour = (hour: number) => {
    const now = new Date();
    return isSameDay(date, now) && now.getHours() === hour;
  };

  return (
    <div className="flex-1 overflow-auto">
      <div className="min-w-[500px]">
        {/* Day header */}
        <div className="sticky top-0 z-10 bg-card border-b border-border">
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

        {/* Time slots */}
        <div>
          {HOURS.map(({ hour, label }) => (
            <div key={hour} className="flex border-b border-border">
              <div className="w-[60px] flex-shrink-0 h-[60px] flex items-start justify-end pr-2 pt-1 text-xs text-muted-foreground border-r border-border">
                {label}
              </div>
              <div
                className={cn(
                  'flex-1 h-[60px] p-2 cursor-pointer transition-colors hover:bg-muted/50 overflow-hidden',
                  isCurrentHour(hour) && 'bg-accent/5'
                )}
                onClick={() => onTimeSlotClick(date, hour)}
              >
                <div className="space-y-1 overflow-y-auto max-h-full">
                  {getBookingsForHour(hour).map((booking) => (
                    <BookingCard
                      key={booking.id}
                      booking={booking}
                      onClick={onBookingClick}
                    />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
