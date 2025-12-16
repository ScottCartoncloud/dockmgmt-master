import { CrossDockBooking } from '@/types/booking';
import { format, isToday, isTomorrow, addDays } from 'date-fns';
import { Calendar, Clock, Package, Truck, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface SidebarProps {
  bookings: CrossDockBooking[];
  onBookingClick: (booking: CrossDockBooking) => void;
}

const statusColors: Record<string, string> = {
  scheduled: 'bg-accent/10 text-accent',
  arrived: 'bg-warning/10 text-warning',
  in_progress: 'bg-accent text-accent-foreground',
  completed: 'bg-success/10 text-success',
  cancelled: 'bg-destructive/10 text-destructive',
};

export function Sidebar({ bookings, onBookingClick }: SidebarProps) {
  const today = new Date();
  const upcomingBookings = bookings
    .filter((b) => b.date >= today && b.status !== 'completed' && b.status !== 'cancelled')
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, 10);

  const getDateLabel = (date: Date) => {
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    return format(date, 'EEE, MMM d');
  };

  const todayStats = {
    total: bookings.filter((b) => isToday(b.date)).length,
    arrived: bookings.filter((b) => isToday(b.date) && b.status === 'arrived').length,
    scheduled: bookings.filter((b) => isToday(b.date) && b.status === 'scheduled').length,
  };

  return (
    <div className="w-80 border-l border-border bg-card flex flex-col">
      {/* Today's Stats */}
      <div className="p-4 border-b border-border">
        <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-accent" />
          Today's Overview
        </h3>
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-3 bg-muted rounded-lg">
            <div className="text-2xl font-bold text-foreground">{todayStats.total}</div>
            <div className="text-xs text-muted-foreground">Total</div>
          </div>
          <div className="text-center p-3 bg-warning/10 rounded-lg">
            <div className="text-2xl font-bold text-warning">{todayStats.arrived}</div>
            <div className="text-xs text-muted-foreground">Arrived</div>
          </div>
          <div className="text-center p-3 bg-accent/10 rounded-lg">
            <div className="text-2xl font-bold text-accent">{todayStats.scheduled}</div>
            <div className="text-xs text-muted-foreground">Pending</div>
          </div>
        </div>
      </div>

      {/* Upcoming Bookings */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <Clock className="w-4 h-4 text-accent" />
            Upcoming Bookings
          </h3>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-3">
            {upcomingBookings.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Info className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No upcoming bookings</p>
              </div>
            ) : (
              upcomingBookings.map((booking) => (
                <div
                  key={booking.id}
                  onClick={() => onBookingClick(booking)}
                  className="p-3 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted transition-colors"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="text-xs font-medium text-accent">
                      {getDateLabel(booking.date)}
                    </span>
                    <Badge className={cn('text-xs', statusColors[booking.status])}>
                      {booking.status}
                    </Badge>
                  </div>
                  <div className="font-medium text-foreground text-sm truncate">
                    {booking.title}
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {booking.startTime}
                    </span>
                    {booking.carrier && (
                      <span className="flex items-center gap-1 truncate">
                        <Truck className="w-3 h-3" />
                        {booking.carrier}
                      </span>
                    )}
                  </div>
                  {booking.purchaseOrder && (
                    <div className="flex items-center gap-1 mt-2 text-xs text-accent">
                      <Package className="w-3 h-3" />
                      PO: {booking.purchaseOrder.reference}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Quick Info */}
      <div className="p-4 border-t border-border bg-muted/30">
        <div className="text-xs text-muted-foreground space-y-1">
          <p className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-accent" />
            Click any time slot to add a booking
          </p>
          <p className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-warning" />
            Click a booking to edit details
          </p>
          <p className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-success" />
            Drag bookings to move them
          </p>
          <p className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-muted-foreground" />
            Drag bottom edge to resize
          </p>
        </div>
      </div>
    </div>
  );
}
