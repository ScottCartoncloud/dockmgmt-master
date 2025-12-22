import { CrossDockBooking, CartonCloudPO } from '@/types/booking';
import { Clock, Truck, Package, GripVertical, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useRef, DragEvent } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import cartonCloudLogo from '@/assets/cartoncloud-logo.png';

interface DraggableBookingCardProps {
  booking: CrossDockBooking;
  onClick: (booking: CrossDockBooking) => void;
  onDragStart?: (booking: CrossDockBooking, offsetMinutes: number) => void;
  onDragEnd?: () => void;
  onResize?: (booking: CrossDockBooking, newEndTime: string) => void;
  compact?: boolean;
  dockColor?: string;
  showDockBadge?: boolean;
}

// Status indicator colors (left border)
// Blue = Scheduled, Green = Arrived, Grey = Completed, Red = Cancelled
const statusBorderColors: Record<string, string> = {
  scheduled: 'border-l-accent',
  arrived: 'border-l-success',
  in_progress: 'border-l-accent',
  completed: 'border-l-muted-foreground',
  cancelled: 'border-l-destructive',
};

type LinkedPOShape = {
  id: string;
  reference: string;
  customer: string;
};

const isValidLinkedPO = (po: unknown): po is LinkedPOShape => {
  if (!po || typeof po !== 'object') return false;
  const anyPO = po as Record<string, unknown>;
  return (
    typeof anyPO.id === 'string' && anyPO.id.length > 0 &&
    typeof anyPO.reference === 'string' && anyPO.reference.length > 0 &&
    typeof anyPO.customer === 'string' && anyPO.customer.length > 0
  );
};

export function DraggableBookingCard({ 
  booking, 
  onClick, 
  onDragStart,
  onDragEnd,
  onResize,
  compact = false,
  dockColor,
  showDockBadge = true,
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
    
    // Calculate the click offset within the card (in minutes)
    // 80px = 1 hour, so offset in minutes = (clickY / 80) * 60
    let offsetMinutes = 0;
    if (cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      const clickOffsetY = e.clientY - rect.top;
      offsetMinutes = Math.round((clickOffsetY / 80) * 60);
      e.dataTransfer.setData('offsetMinutes', offsetMinutes.toString());
      
      // Set drag image anchored at click point for visual accuracy
      e.dataTransfer.setDragImage(cardRef.current, rect.width / 2, clickOffsetY);
    }
    
    onDragStart?.(booking, offsetMinutes);
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
      // 80px per hour, so 20px per 15 minutes
      const quarterHoursDelta = Math.round(deltaY / 20);
      
      const [hours, minutes] = startEndTimeRef.current.split(':').map(Number);
      const totalMinutes = hours * 60 + minutes + (quarterHoursDelta * 15);
      
      // Clamp: minimum 15 min after start, max 23:45
      const startMinutes = parseInt(booking.startTime.split(':')[0]) * 60 + parseInt(booking.startTime.split(':')[1]);
      const clampedMinutes = Math.max(startMinutes + 15, Math.min(23 * 60 + 45, totalMinutes));
      
      const newHours = Math.floor(clampedMinutes / 60);
      const newMins = clampedMinutes % 60;
      const newEndTime = `${newHours.toString().padStart(2, '0')}:${newMins.toString().padStart(2, '0')}`;
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

  // Determine background color - use dock color if provided, otherwise status-based
  const bgStyle = dockColor
    ? { backgroundColor: `${dockColor}20` }
    : undefined;

  const bgClass = !dockColor
    ? booking.status === 'arrived' ? 'bg-warning/10'
      : booking.status === 'in_progress' ? 'bg-accent/10'
      : booking.status === 'completed' ? 'bg-success/10'
      : booking.status === 'cancelled' ? 'bg-destructive/10'
      : 'bg-booking'
    : '';

  // Only show CartonCloud icon when cartonCloudPO is linked (not local purchaseOrder)
  const hasCartonCloudPO = isValidLinkedPO(booking.cartonCloudPO);

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
        'rounded-md p-2 border-l-4 cursor-grab transition-shadow duration-200 hover:shadow-card-hover relative group h-full overflow-hidden',
        statusBorderColors[booking.status],
        bgClass,
        compact ? 'text-xs' : 'text-sm',
        isResizing && 'cursor-ns-resize'
      )}
      style={bgStyle}
    >
      {/* Top-right icons container */}
      <div className="absolute top-1 right-1 flex items-center gap-1">
        {/* CartonCloud linked indicator */}
        {hasCartonCloudPO && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <img 
                  src={cartonCloudLogo} 
                  alt="CartonCloud" 
                  className="w-4 h-4 object-contain"
                />
              </TooltipTrigger>
              <TooltipContent>
                <p>Linked to CartonCloud PO</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {/* Drag handle indicator */}
        <div className="opacity-0 group-hover:opacity-60 transition-opacity">
          <GripVertical className="w-3 h-3 text-muted-foreground" />
        </div>
      </div>

      <div className="font-medium text-foreground truncate pr-8">{booking.title}</div>
      
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

          {booking.pallets !== undefined && booking.pallets > 0 && (
            <div className="flex items-center gap-1 mt-1 text-muted-foreground">
              <Layers className="w-3 h-3" />
              <span>{booking.pallets} pallet{booking.pallets !== 1 ? 's' : ''}</span>
            </div>
          )}
          
          {booking.cartonCloudPO?.reference && (
            <div className="flex items-center gap-1 mt-1 text-accent">
              <Package className="w-3 h-3" />
              <span>PO: {booking.cartonCloudPO.reference}</span>
            </div>
          )}
          
          {booking.dockNumber && showDockBadge && (
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
