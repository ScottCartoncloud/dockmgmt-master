import { CrossDockBooking } from '@/types/booking';
import { HOURS } from '@/lib/calendarConstants';
import { DraggableBookingCard } from './DraggableBookingCard';
import { format, isSameDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { useRef, DragEvent, useMemo, useCallback } from 'react';
import { useDockDoors, DockDoor } from '@/hooks/useDockDoors';
import { Loader2 } from 'lucide-react';
import { calculateBookingLayout, getBookingLayoutStyle } from '@/lib/bookingLayout';
import {
  HOUR_HEIGHT,
  calculateDropMinutes,
  getBookingHeight,
  getBookingPositionStyle,
  extractDragData,
  formatTime,
} from '@/hooks/useDragAndDrop';

const START_HOUR = HOURS[0]?.hour || 6;
const MIN_DOCK_WIDTH = 180;

interface DayViewProps {
  date: Date;
  bookings: CrossDockBooking[];
  onTimeSlotClick: (date: Date, hour: number, dockId?: string) => void;
  onBookingClick: (booking: CrossDockBooking) => void;
  onBookingMove?: (booking: CrossDockBooking, newDate: Date, newHour: number, offsetMinutes: number, newDockId?: string) => void;
  onBookingResize?: (booking: CrossDockBooking, newEndTime: string) => void;
}

export function DayView({ 
  date, 
  bookings, 
  onTimeSlotClick, 
  onBookingClick,
  onBookingMove,
  onBookingResize
}: DayViewProps) {
  const { data: dockDoors, isLoading: isLoadingDocks } = useDockDoors();
  
  // Use refs to avoid re-renders during drag
  const gridRef = useRef<HTMLDivElement>(null);
  const previewRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const dragStateRef = useRef<{ booking: CrossDockBooking | null; offsetMinutes: number; activeDockId: string | null }>({
    booking: null,
    offsetMinutes: 0,
    activeDockId: null,
  });
  const rafIdRef = useRef<number | null>(null);
  const lastDropDataRef = useRef<{ snappedMinutes: number; dockId: string | null } | null>(null);
  
  const activeDocks = useMemo(() => dockDoors?.filter(d => d.is_active) || [], [dockDoors]);
  const dayBookings = useMemo(() => bookings.filter((b) => isSameDay(b.date, date)), [bookings, date]);

  const isCurrentHour = useCallback((hour: number) => {
    const now = new Date();
    return isSameDay(date, now) && now.getHours() === hour;
  }, [date]);

  const getDockIdFromPosition = useCallback((clientX: number): string | null => {
    if (!gridRef.current || activeDocks.length === 0) return null;
    
    const rect = gridRef.current.getBoundingClientRect();
    const xInGrid = clientX - rect.left;
    const dockWidth = rect.width / activeDocks.length;
    const dockIndex = Math.floor(xInGrid / dockWidth);
    
    if (dockIndex >= 0 && dockIndex < activeDocks.length) {
      return activeDocks[dockIndex].id;
    }
    return null;
  }, [activeDocks]);

  const hideAllPreviews = useCallback(() => {
    previewRefs.current.forEach((el) => {
      el.style.display = 'none';
    });
  }, []);

  const updatePreview = useCallback((dockId: string, top: number, height: number, title: string, color: string) => {
    // Cancel any pending RAF
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
    }
    
    rafIdRef.current = requestAnimationFrame(() => {
      // Hide all other previews
      previewRefs.current.forEach((el, id) => {
        if (id !== dockId) {
          el.style.display = 'none';
        }
      });
      
      // Show and position the active preview
      const previewEl = previewRefs.current.get(dockId);
      if (previewEl) {
        previewEl.style.display = 'block';
        previewEl.style.top = `${top}px`;
        previewEl.style.height = `${height}px`;
        previewEl.style.borderColor = color;
        previewEl.style.backgroundColor = `${color}20`;
        
        const textEl = previewEl.querySelector('[data-preview-text]') as HTMLElement;
        if (textEl) {
          textEl.textContent = title;
          textEl.style.color = color;
        }
      }
      
      rafIdRef.current = null;
    });
  }, []);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    if (!gridRef.current || !dragStateRef.current.booking) return;
    
    const rect = gridRef.current.getBoundingClientRect();
    const dockId = getDockIdFromPosition(e.clientX);
    const { snappedMinutes, topPosition } = calculateDropMinutes(
      e.clientY,
      rect.top,
      START_HOUR,
      dragStateRef.current.offsetMinutes
    );
    
    // Store last calculated drop data for use in handleDrop
    lastDropDataRef.current = { snappedMinutes, dockId };
    dragStateRef.current.activeDockId = dockId;
    
    const height = getBookingHeight(dragStateRef.current.booking);
    const dock = activeDocks.find(d => d.id === dockId);
    const color = dock?.color || 'hsl(var(--accent))';
    
    if (dockId) {
      updatePreview(dockId, topPosition, height, dragStateRef.current.booking.title, color);
    }
  }, [activeDocks, getDockIdFromPosition, updatePreview]);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    if (!gridRef.current?.contains(e.relatedTarget as Node)) {
      hideAllPreviews();
      dragStateRef.current.activeDockId = null;
    }
  }, [hideAllPreviews]);

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    
    const dragData = extractDragData(e);
    if (!dragData || !onBookingMove || !gridRef.current) {
      hideAllPreviews();
      return;
    }
    
    const rect = gridRef.current.getBoundingClientRect();
    const dockId = getDockIdFromPosition(e.clientX);
    const { snappedMinutes } = calculateDropMinutes(
      e.clientY,
      rect.top,
      START_HOUR,
      dragData.offsetMinutes
    );
    
    // Convert snapped minutes to hour fraction for callback
    const preciseDropHour = snappedMinutes / 60;
    
    onBookingMove(dragData.booking, date, preciseDropHour, 0, dockId || undefined);
    hideAllPreviews();
  }, [date, getDockIdFromPosition, hideAllPreviews, onBookingMove]);

  const handleDragStart = useCallback((booking: CrossDockBooking, offsetMinutes: number) => {
    dragStateRef.current = { booking, offsetMinutes, activeDockId: null };
  }, []);

  const handleDragEnd = useCallback(() => {
    dragStateRef.current = { booking: null, offsetMinutes: 0, activeDockId: null };
    lastDropDataRef.current = null;
    hideAllPreviews();
    
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
  }, [hideAllPreviews]);

  // Group bookings by dock - primary match is dock_door_id, fallback to dock number
  const getBookingsForDock = useCallback((dock: DockDoor) => {
    return dayBookings.filter(booking => {
      // Primary: match by dock door ID
      if (booking.dockDoorId) {
        return booking.dockDoorId === dock.id;
      }
      // Fallback: match by dock number (for older bookings)
      if (booking.dockNumber) {
        const dockNum = parseInt(dock.name.replace(/\D/g, ''), 10);
        return booking.dockNumber === dockNum || dock.name.includes(booking.dockNumber.toString());
      }
      return false;
    });
  }, [dayBookings]);

  // Calculate layout for each dock's bookings
  const dockLayouts = useMemo(() => {
    const layouts = new Map<string, Map<string, { column: number; totalColumns: number }>>();
    
    activeDocks.forEach(dock => {
      const dockBookings = getBookingsForDock(dock);
      const positions = calculateBookingLayout(dockBookings);
      
      const bookingMap = new Map<string, { column: number; totalColumns: number }>();
      positions.forEach(pos => {
        bookingMap.set(pos.booking.id, { column: pos.column, totalColumns: pos.totalColumns });
      });
      
      layouts.set(dock.id, bookingMap);
    });
    
    return layouts;
  }, [dayBookings, activeDocks, getBookingsForDock]);

  // Bookings without an assigned dock
  const unassignedBookings = useMemo(() => dayBookings.filter(booking => !booking.dockNumber), [dayBookings]);

  if (isLoadingDocks) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (activeDocks.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <p className="text-lg font-medium">No dock doors configured</p>
          <p className="text-sm mt-1">Go to Settings → Dock Config to add dock doors.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      <div style={{ minWidth: Math.max(500, activeDocks.length * MIN_DOCK_WIDTH + 60) }}>
        {/* Header with dock columns */}
        <div className="sticky top-0 z-20 bg-card border-b border-border">
          <div className="flex">
            {/* Time column header */}
            <div className="w-[60px] flex-shrink-0 p-2 border-r border-border">
              <div className="text-xs text-muted-foreground text-center">
                {format(date, 'EEE')}
                <div className={cn(
                  'text-lg font-semibold mt-1 w-8 h-8 mx-auto flex items-center justify-center rounded-full',
                  isSameDay(date, new Date()) && 'bg-accent text-accent-foreground'
                )}>
                  {format(date, 'd')}
                </div>
              </div>
            </div>
            
            {/* Dock column headers */}
            {activeDocks.map((dock) => (
              <div
                key={dock.id}
                className="flex-1 p-3 border-r border-border last:border-r-0 text-center"
                style={{ minWidth: MIN_DOCK_WIDTH }}
              >
                <div className="flex items-center justify-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: dock.color }}
                  />
                  <span className="font-medium text-foreground">{dock.name}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Time grid with dock columns */}
        <div className="flex">
          {/* Time labels column */}
          <div className="w-[60px] flex-shrink-0 border-r border-border">
            {HOURS.map(({ hour, label }) => (
              <div 
                key={hour} 
                className="relative border-b border-border"
                style={{ height: HOUR_HEIGHT }}
              >
                <div className="absolute top-0 right-2 text-xs text-muted-foreground">
                  {label}
                </div>
                <div className="absolute top-[25%] right-2 text-[10px] text-muted-foreground/50">
                  :15
                </div>
                <div className="absolute top-[50%] right-2 text-[10px] text-muted-foreground/60">
                  :30
                </div>
                <div className="absolute top-[75%] right-2 text-[10px] text-muted-foreground/50">
                  :45
                </div>
              </div>
            ))}
          </div>

          {/* Dock columns grid */}
          <div 
            ref={gridRef}
            className="flex-1 flex relative"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {activeDocks.map((dock, dockIndex) => {
              const dockBookings = getBookingsForDock(dock);
              
              return (
                <div
                  key={dock.id}
                  className="flex-1 relative border-r border-border last:border-r-0"
                  style={{ minWidth: MIN_DOCK_WIDTH }}
                >
                  {/* Hour grid lines and click targets */}
                  {HOURS.map(({ hour }) => (
                    <div
                      key={hour}
                      className={cn(
                        'border-b border-border cursor-pointer transition-colors relative',
                        isCurrentHour(hour) && 'bg-accent/5',
                        'hover:bg-muted/50'
                      )}
                      style={{ height: HOUR_HEIGHT }}
                      onClick={() => onTimeSlotClick(date, hour, dock.id)}
                    >
                      {/* 15-minute tick marks */}
                      <div className="absolute left-0 right-0 top-[25%] border-t border-dashed border-border/40" />
                      <div className="absolute left-0 right-0 top-[50%] border-t border-dotted border-border/60" />
                      <div className="absolute left-0 right-0 top-[75%] border-t border-dashed border-border/40" />
                    </div>
                  ))}

                  {/* Bookings for this dock */}
                  <div className="absolute inset-0 pointer-events-none">
                    {dockBookings.map((booking) => {
                      const style = getBookingPositionStyle(booking, START_HOUR);
                      const layout = dockLayouts.get(dock.id)?.get(booking.id);
                      const layoutStyle = layout
                        ? getBookingLayoutStyle(layout.column, layout.totalColumns, 4)
                        : { left: '4px', right: '4px' };

                      return (
                        <div
                          key={booking.id}
                          className="absolute pointer-events-auto z-10"
                          style={{
                            top: style.top,
                            height: style.height,
                            left: layoutStyle.left,
                            right: layoutStyle.right,
                          }}
                        >
                          <DraggableBookingCard
                            booking={booking}
                            onClick={onBookingClick}
                            onDragStart={handleDragStart}
                            onDragEnd={handleDragEnd}
                            onResize={onBookingResize}
                            dockColor={dock.color}
                            showDockBadge={false}
                          />
                        </div>
                      );
                    })}
                  </div>

                  {/* Drag preview for this dock - managed via refs for performance */}
                  <div
                    ref={(el) => {
                      if (el) previewRefs.current.set(dock.id, el);
                      else previewRefs.current.delete(dock.id);
                    }}
                    className="absolute left-1 right-1 pointer-events-none z-20 rounded-md border-2 border-dashed hidden"
                    style={{ display: 'none' }}
                  >
                    <div data-preview-text className="p-2 text-sm font-medium truncate" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Unassigned bookings indicator */}
        {unassignedBookings.length > 0 && (
          <div className="sticky bottom-0 bg-warning/10 border-t border-warning/30 p-3">
            <div className="text-sm text-warning-foreground">
              <span className="font-medium">{unassignedBookings.length} booking(s)</span> without assigned dock:
              {unassignedBookings.slice(0, 3).map(b => (
                <button
                  key={b.id}
                  onClick={() => onBookingClick(b)}
                  className="ml-2 underline hover:no-underline"
                >
                  {b.title}
                </button>
              ))}
              {unassignedBookings.length > 3 && <span className="ml-1">and {unassignedBookings.length - 3} more...</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
