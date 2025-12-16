import { CrossDockBooking } from '@/types/booking';
import { HOURS } from '@/data/mockData';
import { BookingCard } from './BookingCard';
import { format, startOfWeek, addDays, isSameDay } from 'date-fns';
import { cn } from '@/lib/utils';

interface WeekViewProps {
  date: Date;
  bookings: CrossDockBooking[];
  onTimeSlotClick: (date: Date, hour: number) => void;
  onBookingClick: (booking: CrossDockBooking) => void;
}

export function WeekView({ date, bookings, onTimeSlotClick, onBookingClick }: WeekViewProps) {
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
                return (
                  <div
                    key={`${day.toISOString()}-${hour}`}
                    className={cn(
                      'flex-1 h-[60px] p-1 cursor-pointer transition-colors hover:bg-muted/50 border-r border-border last:border-r-0 overflow-hidden',
                      isCurrentHour(day, hour) && 'bg-accent/5'
                    )}
                    onClick={() => onTimeSlotClick(day, hour)}
                  >
                    <div className="space-y-1 overflow-y-auto max-h-full">
                      {slotBookings.map((booking) => (
                        <BookingCard
                          key={booking.id}
                          booking={booking}
                          onClick={onBookingClick}
                          compact
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
