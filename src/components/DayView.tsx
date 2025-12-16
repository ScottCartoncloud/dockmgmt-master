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
      <div className="min-w-[600px]">
        {/* Day header */}
        <div className="sticky top-0 z-10 bg-card border-b border-border">
          <div className="grid grid-cols-[80px_1fr]">
            <div className="p-3 border-r border-border" />
            <div className="p-3 text-center">
              <div className="text-sm text-muted-foreground">
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
        <div className="relative">
          {HOURS.map(({ hour, label }) => (
            <div
              key={hour}
              className="grid grid-cols-[80px_1fr] border-b border-border"
            >
              <div className="p-2 text-right pr-3 text-sm text-muted-foreground border-r border-border">
                {label}
              </div>
              <div
                className={cn(
                  'min-h-[80px] p-2 cursor-pointer transition-colors hover:bg-muted/50',
                  isCurrentHour(hour) && 'bg-accent/5'
                )}
                onClick={() => onTimeSlotClick(date, hour)}
              >
                <div className="space-y-2">
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
