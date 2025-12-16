import { useState, useEffect } from 'react';
import { CrossDockBooking } from '@/types/booking';
import { format, isToday } from 'date-fns';
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

  // Today's bookings for stats and display
  const todayBookings = bookings.filter((b) => isToday(b.date));
  
  const todayStats = {
    total: todayBookings.length,
    arrived: todayBookings.filter((b) => b.status === 'arrived').length,
    pending: todayBookings.filter((b) => b.status !== 'arrived' && b.status !== 'cancelled').length,
  };

  // Filter today's bookings based on active filter
  const filteredTodayBookings = todayBookings
    .filter((booking) => {
      if (activeFilter === 'all') return true;
      if (activeFilter === 'arrived') return booking.status === 'arrived';
      if (activeFilter === 'scheduled') return booking.status !== 'arrived' && booking.status !== 'cancelled';
      return true;
    })
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  // Dynamic header based on filter
  const getListHeader = () => {
    switch (activeFilter) {
      case 'arrived': return "Today's Arrived Bookings";
      case 'scheduled': return "Today's Pending Bookings";
      default: return "All Bookings Today";
    }
  };

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
    <div className="w-80 border-l border-border bg-card flex flex-col h-full transition-all duration-300">
      {/* Collapse Button */}
      <div className="flex justify-end p-2 border-b border-border shrink-0">
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
      <div className="p-4 border-b border-border shrink-0">
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
            className="bg-success/10"
          />
          <StatCard
            label="Pending"
            value={todayStats.pending}
            filter="scheduled"
            className="bg-accent/10"
          />
        </div>
      </div>

      {/* Dynamic Booking List - Uses full remaining height */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="px-4 py-3 border-b border-border shrink-0">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <Clock className="w-4 h-4 text-accent" />
            {getListHeader()}
            <Badge variant="secondary" className="ml-auto">
              {filteredTodayBookings.length}
            </Badge>
          </h3>
          {activeFilter !== 'all' && (
            <button
              onClick={() => setActiveFilter('all')}
              className="mt-1 text-xs text-accent hover:underline"
            >
              Show all bookings
            </button>
          )}
        </div>
        
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-3">
            {filteredTodayBookings.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Info className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm font-medium">No bookings found</p>
                <p className="text-xs mt-1 opacity-70">
                  {activeFilter === 'all' 
                    ? 'No bookings scheduled for today' 
                    : activeFilter === 'arrived'
                      ? 'No arrived bookings yet'
                      : 'No pending bookings'}
                </p>
              </div>
            ) : (
              filteredTodayBookings.map((booking) => (
                <div
                  key={booking.id}
                  onClick={() => onBookingClick(booking)}
                  className={cn(
                    "p-3 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted transition-colors border-l-4",
                    booking.status === 'scheduled' && "border-l-accent",
                    booking.status === 'arrived' && "border-l-success",
                    booking.status === 'in_progress' && "border-l-accent",
                    booking.status === 'completed' && "border-l-muted-foreground opacity-60",
                    booking.status === 'cancelled' && "border-l-destructive opacity-50"
                  )}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      {booking.startTime} - {booking.endTime}
                    </span>
                    <Badge className={cn('text-xs', statusColors[booking.status])}>
                      {booking.status.replace('_', ' ')}
                    </Badge>
                  </div>
                  <div className="font-medium text-foreground text-sm truncate">
                    {booking.title}
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    {booking.carrier && (
                      <span className="flex items-center gap-1 truncate">
                        <Truck className="w-3 h-3" />
                        {booking.carrier}
                      </span>
                    )}
                    {booking.dockNumber && (
                      <span className="flex items-center gap-1 truncate">
                        Dock {booking.dockNumber}
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
    </div>
  );
}
