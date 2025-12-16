import { CrossDockBooking } from '@/types/booking';
import { Clock, Truck, Package } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BookingCardProps {
  booking: CrossDockBooking;
  onClick: (booking: CrossDockBooking) => void;
  compact?: boolean;
}

const statusColors: Record<string, string> = {
  scheduled: 'border-l-accent bg-booking',
  arrived: 'border-l-warning bg-warning/10',
  in_progress: 'border-l-accent bg-accent/10',
  completed: 'border-l-success bg-success/10',
  cancelled: 'border-l-destructive bg-destructive/10',
};

const statusLabels: Record<string, string> = {
  scheduled: 'Scheduled',
  arrived: 'Arrived',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export function BookingCard({ booking, onClick, compact = false }: BookingCardProps) {
  return (
    <div
      onClick={() => onClick(booking)}
      className={cn(
        'rounded-md p-2 border-l-4 cursor-pointer transition-all duration-200 hover:shadow-card-hover',
        statusColors[booking.status],
        compact ? 'text-xs' : 'text-sm'
      )}
    >
      <div className="font-medium text-foreground truncate">{booking.title}</div>
      
      {!compact && (
        <>
          <div className="flex items-center gap-1 mt-1 text-muted-foreground">
            <Clock className="w-3 h-3" />
            <span>{booking.startTime} - {booking.endTime}</span>
          </div>
          
          {booking.carrier && (
            <div className="flex items-center gap-1 mt-1 text-muted-foreground">
              <Truck className="w-3 h-3" />
              <span className="truncate">{booking.carrier}</span>
            </div>
          )}
          
          {booking.purchaseOrder && (
            <div className="flex items-center gap-1 mt-1 text-accent">
              <Package className="w-3 h-3" />
              <span>PO: {booking.purchaseOrder.reference}</span>
            </div>
          )}
          
          {booking.dockNumber && (
            <div className="mt-2 inline-block px-2 py-0.5 bg-primary/10 text-primary text-xs rounded">
              Dock {booking.dockNumber}
            </div>
          )}
        </>
      )}
      
      {compact && (
        <div className="text-muted-foreground mt-0.5">
          {booking.startTime} - {booking.endTime}
        </div>
      )}
    </div>
  );
}
