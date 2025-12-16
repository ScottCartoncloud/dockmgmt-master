import { CrossDockBooking } from '@/types/booking';
import { Clock, Truck, Package, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useRef, DragEvent } from 'react';

interface DraggableBookingCardProps {
  booking: CrossDockBooking;
  onClick: (booking: CrossDockBooking) => void;
  onDragStart?: (booking: CrossDockBooking) => void;
  onDragEnd?: () => void;
  onResize?: (booking: CrossDockBooking, newEndTime: string) => void;
  compact?: boolean;
  isDragging?: boolean;
}

const statusColors: Record<string, string> = {
  scheduled: 'border-l-accent bg-booking',
  arrived: 'border-l-warning bg-warning/10',
  in_progress: 'border-l-accent bg-accent/10',
  completed: 'border-l-success bg-success/10',
  cancelled: 'border-l-destructive bg-destructive/10',
};

export function DraggableBookingCard({ 
  booking, 
  onClick, 
  onDragStart,
  onDragEnd,
  onResize,
  compact = false,
  isDragging = false 
}: DraggableBookingCardProps) {
  const [isResizing, setIsResizing] = useState(false);
  const [resizePreview, setResizePreview] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef<number>(0);
  const startEndTimeRef = useRef<string>('');

  const handleDragStart = (e: DragEvent<HTMLDivElement>) => {
    e.dataTransfer.setData('bookingId', booking.id);
    e.dataTransfer.setData('bookingData', JSON.stringify(booking));
    e.dataTransfer.effectAllowed = 'move';
    
    // Create a drag image
    if (cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      e.dataTransfer.setDragImage(cardRef.current, rect.width / 2, 20);
    }
    
    onDragStart?.(booking);
  };

  const handleDragEnd = () => {
    onDragEnd?.();
  };

  const handleResizeStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsResizing(true);
    startYRef.current = e.clientY;
    startEndTimeRef.current = booking.endTime;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - startYRef.current;
      const hoursDelta = Math.round(deltaY / 60); // 60px per hour
      
      const [hours, minutes] = startEndTimeRef.current.split(':').map(Number);
      let newHours = hours + hoursDelta;
      
      // Clamp between start time + 1 hour and 23:00
      const startHour = parseInt(booking.startTime.split(':')[0]);
      newHours = Math.max(startHour + 1, Math.min(23, newHours));
      
      const newEndTime = `${newHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      setResizePreview(newEndTime);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      if (resizePreview && resizePreview !== booking.endTime) {
        onResize?.(booking, resizePreview);
      }
      setResizePreview(null);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const displayEndTime = resizePreview || booking.endTime;

  return (
    <div
      ref={cardRef}
      draggable={!isResizing}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={(e) => {
        if (!isResizing) {
          e.stopPropagation();
          onClick(booking);
        }
      }}
      className={cn(
        'rounded-md p-2 border-l-4 cursor-grab transition-all duration-200 hover:shadow-card-hover relative group',
        statusColors[booking.status],
        compact ? 'text-xs' : 'text-sm',
        isDragging && 'opacity-50 shadow-lg',
        isResizing && 'cursor-ns-resize'
      )}
    >
      {/* Drag handle indicator */}
      <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-60 transition-opacity">
        <GripVertical className="w-3 h-3 text-muted-foreground" />
      </div>

      <div className="font-medium text-foreground truncate pr-4">{booking.title}</div>
      
      {!compact && (
        <>
          <div className="flex items-center gap-1 mt-1 text-muted-foreground">
            <Clock className="w-3 h-3" />
            <span>{booking.startTime} - {displayEndTime}</span>
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

          {/* Resize handle */}
          {onResize && (
            <div
              onMouseDown={handleResizeStart}
              className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize bg-transparent hover:bg-accent/20 transition-colors rounded-b-md"
              title="Drag to resize"
            />
          )}
        </>
      )}
      
      {compact && (
        <>
          <div className="text-muted-foreground mt-0.5">
            {booking.startTime} - {displayEndTime}
          </div>
          {/* Resize handle for compact view */}
          {onResize && (
            <div
              onMouseDown={handleResizeStart}
              className="absolute bottom-0 left-0 right-0 h-1.5 cursor-ns-resize bg-transparent hover:bg-accent/20 transition-colors rounded-b-md"
              title="Drag to resize"
            />
          )}
        </>
      )}

      {/* Resize preview indicator */}
      {isResizing && resizePreview && (
        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-foreground text-background text-xs px-2 py-1 rounded shadow-lg z-50 whitespace-nowrap">
          {booking.startTime} - {resizePreview}
        </div>
      )}
    </div>
  );
}
