import { CrossDockBooking } from '@/types/booking';
import { HOURS } from '@/lib/calendarConstants';
import { DraggableBookingCard } from './DraggableBookingCard';
import { format, startOfWeek, addDays, isSameDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { useRef, DragEvent, useMemo, useCallback } from 'react';
import { useDockDoors } from '@/hooks/useDockDoors';
import { calculateBookingLayout, getBookingLayoutStyle } from '@/lib/bookingLayout';
import {
  HOUR_HEIGHT,
  calculateDropMinutes,
  getBookingHeight,
  getBookingPositionStyle,
  extractDragData,
} from '@/hooks/useDragAndDrop';

const START_HOUR = HOURS[0]?.hour || 6;

interface WeekViewProps {
  date: Date;
  bookings: CrossDockBooking[];
  onTimeSlotClick: (date: Date, hour: number) => void;
  onBookingClick: (booking: CrossDockBooking) => void;
  onBookingMove?: (booking: CrossDockBooking, newDate: Date, newHour: number, offsetMinutes: number) => void;
  onBookingResize?: (booking: CrossDockBooking, newEndTime: string) => void;
}

export function WeekView({ 
  date, 
  bookings, 
  onTimeSlotClick, 
  onBookingClick,
  onBookingMove,
  onBookingResize
}: WeekViewProps) {
  const { data: dockDoors } = useDockDoors();
  
  // Use refs for drag state to avoid re-renders
  const gridRefs = useRef<(HTMLDivElement | null)[]>([]);
  const previewRefs = useRef<(HTMLDivElement | null)[]>([]);
  const dragStateRef = useRef<{ booking: CrossDockBooking | null; offsetMinutes: number; activeDayIndex: number | null }>({
    booking: null,
    offsetMinutes: 0,
    activeDayIndex: null,
  });
  const rafIdRef = useRef<number | null>(null);
  
  const activeDocks = useMemo(() => dockDoors?.filter(d => d.is_active) || [], [dockDoors]);
  const weekStart = useMemo(() => startOfWeek(date, { weekStartsOn: 1 }), [date]);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  // Get dock color for a booking based on its dock door ID (fallback to dock number for backwards compat)
  const getDockColorForBooking = useCallback((booking: CrossDockBooking): string | undefined => {
    // Primary: lookup by dock door ID
    if (booking.dockDoorId) {
      const dock = activeDocks.find(d => d.id === booking.dockDoorId);
      if (dock) return dock.color;
    }
    // Fallback: lookup by dock number (for older bookings or manual entry)
    if (booking.dockNumber) {
      const dock = activeDocks.find(d => 
        d.name.includes(booking.dockNumber!.toString()) || 
        parseInt(d.name.replace(/\D/g, ''), 10) === booking.dockNumber
      );
      return dock?.color;
    }
    return undefined;
  }, [activeDocks]);

  const getBookingsForDay = useCallback((day: Date) => {
    return bookings.filter((b) => isSameDay(b.date, day));
  }, [bookings]);

  // Calculate layout for each day's bookings
  const dayLayouts = useMemo(() => {
    const layouts = new Map<string, Map<string, { column: number; totalColumns: number }>>();
    
    weekDays.forEach(day => {
      const dayKey = format(day, 'yyyy-MM-dd');
      const dayBookings = getBookingsForDay(day);
      const positions = calculateBookingLayout(dayBookings);
      
      const bookingMap = new Map<string, { column: number; totalColumns: number }>();
      positions.forEach(pos => {
        bookingMap.set(pos.booking.id, { column: pos.column, totalColumns: pos.totalColumns });
      });
      
      layouts.set(dayKey, bookingMap);
    });
    
    return layouts;
  }, [bookings, weekDays, getBookingsForDay]);

  const isCurrentHour = useCallback((day: Date, hour: number) => {
    const now = new Date();
    return isSameDay(day, now) && now.getHours() === hour;
  }, []);

  const hideAllPreviews = useCallback(() => {
    previewRefs.current.forEach((el) => {
      if (el) el.style.display = 'none';
    });
  }, []);

  const updatePreview = useCallback((dayIndex: number, top: number, height: number, title: string) => {
    // Cancel any pending RAF
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
    }
    
    rafIdRef.current = requestAnimationFrame(() => {
      // Hide all other previews
      previewRefs.current.forEach((el, idx) => {
        if (el && idx !== dayIndex) {
          el.style.display = 'none';
        }
      });
      
      // Show and position the active preview
      const previewEl = previewRefs.current[dayIndex];
      if (previewEl) {
        previewEl.style.display = 'block';
        previewEl.style.top = `${top}px`;
        previewEl.style.height = `${height}px`;
        
        const textEl = previewEl.querySelector('[data-preview-text]') as HTMLElement;
        if (textEl) {
          textEl.textContent = title;
        }
      }
      
      rafIdRef.current = null;
    });
  }, []);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>, dayIndex: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    const gridEl = gridRefs.current[dayIndex];
    if (!gridEl || !dragStateRef.current.booking) return;
    
    const rect = gridEl.getBoundingClientRect();
    const { topPosition } = calculateDropMinutes(
      e.clientY,
      rect.top,
      START_HOUR,
      dragStateRef.current.offsetMinutes
    );
    
    const height = getBookingHeight(dragStateRef.current.booking);
    dragStateRef.current.activeDayIndex = dayIndex;
    
    updatePreview(dayIndex, topPosition, height, dragStateRef.current.booking.title);
  }, [updatePreview]);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>, dayIndex: number) => {
    const gridEl = gridRefs.current[dayIndex];
    if (!gridEl?.contains(e.relatedTarget as Node)) {
      // Check if moving to another day column
      const isMovingToAnotherDay = gridRefs.current.some((ref, idx) => 
        idx !== dayIndex && ref?.contains(e.relatedTarget as Node)
      );
      if (!isMovingToAnotherDay) {
        hideAllPreviews();
        dragStateRef.current.activeDayIndex = null;
      }
    }
  }, [hideAllPreviews]);

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>, day: Date, dayIndex: number) => {
    e.preventDefault();
    
    const dragData = extractDragData(e);
    const gridEl = gridRefs.current[dayIndex];
    
    if (!dragData || !onBookingMove || !gridEl) {
      hideAllPreviews();
      return;
    }
    
    const rect = gridEl.getBoundingClientRect();
    const { snappedMinutes } = calculateDropMinutes(
      e.clientY,
      rect.top,
      START_HOUR,
      dragData.offsetMinutes
    );
    
    const preciseDropHour = snappedMinutes / 60;
    onBookingMove(dragData.booking, day, preciseDropHour, 0);
    
    hideAllPreviews();
  }, [hideAllPreviews, onBookingMove]);

  const handleDragStart = useCallback((booking: CrossDockBooking, offsetMinutes: number) => {
    dragStateRef.current = { booking, offsetMinutes, activeDayIndex: null };
  }, []);

  const handleDragEnd = useCallback(() => {
    dragStateRef.current = { booking: null, offsetMinutes: 0, activeDayIndex: null };
    hideAllPreviews();
    
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
  }, [hideAllPreviews]);

  return (
    <div className="flex-1 overflow-auto">
      <div className="min-w-[900px]">
        {/* Week header */}
        <div className="sticky top-0 z-20 bg-card border-b border-border">
          <div className="flex">
            <div className="w-[60px] flex-shrink-0 p-2 border-r border-border" />
            {weekDays.map((day) => (
              <div 
                key={format(day, 'yyyy-MM-dd')} 
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

        {/* Time grid with bookings overlay */}
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

          {/* Day columns */}
          {weekDays.map((day, dayIndex) => {
            const dayBookings = getBookingsForDay(day);
            
            return (
              <div 
                key={format(day, 'yyyy-MM-dd')} 
                ref={(el) => { gridRefs.current[dayIndex] = el; }}
                className="flex-1 relative border-r border-border last:border-r-0"
                onDragOver={(e) => handleDragOver(e, dayIndex)}
                onDragLeave={(e) => handleDragLeave(e, dayIndex)}
                onDrop={(e) => handleDrop(e, day, dayIndex)}
              >
                {/* Hour grid lines and click targets */}
                {HOURS.map(({ hour }) => (
                  <div
                    key={hour}
                    className={cn(
                      'border-b border-border cursor-pointer transition-colors relative',
                      isCurrentHour(day, hour) && 'bg-accent/5',
                      'hover:bg-muted/50'
                    )}
                    style={{ height: HOUR_HEIGHT }}
                    onClick={() => onTimeSlotClick(day, hour)}
                  >
                    {/* 15-minute tick marks */}
                    <div className="absolute left-0 right-0 top-[25%] border-t border-dashed border-border/40" />
                    <div className="absolute left-0 right-0 top-[50%] border-t border-dotted border-border/60" />
                    <div className="absolute left-0 right-0 top-[75%] border-t border-dashed border-border/40" />
                  </div>
                ))}

                {/* Drag preview ghost for this column - managed via refs */}
                <div
                  ref={(el) => { previewRefs.current[dayIndex] = el; }}
                  className="absolute left-0.5 right-0.5 pointer-events-none z-20 rounded-md border-2 border-dashed border-accent bg-accent/20 hidden"
                  style={{ display: 'none' }}
                >
                  <div data-preview-text className="p-1 text-xs font-medium text-accent truncate" />
                </div>

                {/* Bookings overlay - positioned absolutely */}
                <div className="absolute inset-0 pointer-events-none">
                  {dayBookings.map((booking) => {
                    const style = getBookingPositionStyle(booking, START_HOUR);
                    const layout = dayLayouts.get(format(day, 'yyyy-MM-dd'))?.get(booking.id);
                    const layoutStyle = layout
                      ? getBookingLayoutStyle(layout.column, layout.totalColumns, 2)
                      : { left: '2px', right: '2px' };

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
                          compact
                          dockColor={getDockColorForBooking(booking)}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
