import { useState, useEffect } from 'react';
import { CrossDockBooking } from '@/types/booking';
import { format, isToday, isTomorrow, startOfDay, isAfter } from 'date-fns';
import { Calendar, Clock, Package, Truck, Info, ChevronRight, ChevronLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
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

type FilterType = 'all' | 'arrived' | 'scheduled';

export function Sidebar({ bookings, onBookingClick }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    return saved ? JSON.parse(saved) : false;
  });
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', JSON.stringify(collapsed));
  }, [collapsed]);

  const today = startOfDay(new Date());
  
  // Today's bookings for stats
  const todayBookings = bookings.filter((b) => isToday(b.date));
  
  const todayStats = {
    total: todayBookings.length,
    arrived: todayBookings.filter((b) => b.status === 'arrived').length,
    pending: todayBookings.filter((b) => b.status !== 'arrived' && b.status !== 'cancelled').length,
  };

  // Upcoming bookings = AFTER today (not including today)
  const upcomingBookings = bookings
    .filter((b) => isAfter(startOfDay(b.date), today) && b.status !== 'cancelled')
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, 5);

  const getDateLabel = (date: Date) => {
    if (isTomorrow(date)) return 'Tomorrow';
    return format(date, 'EEE, MMM d');
  };

  // Filter upcoming bookings based on active filter (for today's bookings view when filtered)
  const filteredTodayBookings = todayBookings.filter((booking) => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'arrived') return booking.status === 'arrived';
    if (activeFilter === 'scheduled') return booking.status !== 'arrived' && booking.status !== 'cancelled';
    return true;
  });

  const StatCard = ({ 
    label, 
    value, 
    filter, 
    className 
  }: { 
    label: string; 
    value: number; 
    filter: FilterType; 
    className?: string;
  }) => (
    <button
      onClick={() => setActiveFilter(filter)}
      className={cn(
        'text-center p-3 rounded-lg transition-all duration-200 cursor-pointer',
        'hover:ring-2 hover:ring-accent/50',
        activeFilter === filter && 'ring-2 ring-accent shadow-sm',
        className
      )}
    >
      <div className={cn(
        'text-2xl font-bold transition-colors',
        activeFilter === filter ? 'text-accent' : ''
      )}>
        {value}
      </div>
      <div className={cn(
        'text-xs transition-colors',
        activeFilter === filter ? 'text-accent font-medium' : 'text-muted-foreground'
      )}>
        {label}
      </div>
    </button>
  );

  // Collapsed state - show only toggle button
  if (collapsed) {
    return (
      <div className="border-l border-border bg-card flex flex-col items-center py-4 w-12 transition-all duration-300">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(false)}
          className="mb-4"
          title="Expand sidebar"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <Calendar className="w-4 h-4" />
          <span className="text-xs font-medium">{todayStats.total}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-80 border-l border-border bg-card flex flex-col transition-all duration-300">
      {/* Collapse Button */}
      <div className="flex justify-end p-2 border-b border-border">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(true)}
          title="Collapse sidebar"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Today's Stats */}
      <div className="p-4 border-b border-border">
        <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-accent" />
          Today's Overview
        </h3>
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            label="Total"
            value={todayStats.total}
            filter="all"
            className="bg-muted"
          />
          <StatCard
            label="Arrived"
            value={todayStats.arrived}
            filter="arrived"
            className="bg-warning/10"
          />
          <StatCard
            label="Pending"
            value={todayStats.pending}
            filter="scheduled"
            className="bg-accent/10"
          />
        </div>
        {activeFilter !== 'all' && (
          <button
            onClick={() => setActiveFilter('all')}
            className="mt-2 text-xs text-accent hover:underline w-full text-center"
          >
            Clear filter
          </button>
        )}
      </div>

      {/* Today's Bookings (when filtered) */}
      {activeFilter !== 'all' && (
        <div className="flex-1 flex flex-col min-h-0 border-b border-border">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <Clock className="w-4 h-4 text-accent" />
              {activeFilter === 'arrived' ? "Today's Arrived" : "Today's Pending"}
              <Badge variant="secondary" className="ml-auto">
                {filteredTodayBookings.length}
              </Badge>
            </h3>
          </div>
          <ScrollArea className="flex-1 max-h-48">
            <div className="p-4 space-y-3">
              {filteredTodayBookings.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">
                  <Info className="w-6 h-6 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No {activeFilter === 'arrived' ? 'arrived' : 'pending'} bookings today</p>
                </div>
              ) : (
                filteredTodayBookings.map((booking) => (
                  <div
                    key={booking.id}
                    onClick={() => onBookingClick(booking)}
                    className="p-3 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span className="text-xs font-medium text-accent">Today</span>
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
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Upcoming Bookings (after today) */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <Clock className="w-4 h-4 text-accent" />
            Upcoming Bookings
            <Badge variant="secondary" className="ml-auto">
              {upcomingBookings.length}
            </Badge>
          </h3>
          <p className="text-xs text-muted-foreground mt-1">Showing bookings after today</p>
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
                  className={cn(
                    "p-3 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted transition-colors",
                    booking.status === 'completed' && "opacity-60"
                  )}
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
