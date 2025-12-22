import { useRef, useCallback, DragEvent } from 'react';
import { CrossDockBooking } from '@/types/booking';

export const HOUR_HEIGHT = 80; // pixels per hour
export const QUARTER_HEIGHT = HOUR_HEIGHT / 4; // 20px per 15 minutes

export interface DragState {
  booking: CrossDockBooking | null;
  offsetMinutes: number;
}

export interface SnapResult {
  snappedMinutes: number;
  topPosition: number;
}

/**
 * Snap a minute value to the nearest 15-minute interval
 */
export function snapTo15Minutes(minutes: number): number {
  return Math.round(minutes / 15) * 15;
}

/**
 * Clamp minutes within valid day bounds (startHour to 23:45)
 */
export function clampMinutes(minutes: number, startHour: number): number {
  const minMinutes = startHour * 60;
  const maxMinutes = 23 * 60 + 45;
  return Math.max(minMinutes, Math.min(maxMinutes, minutes));
}

/**
 * Calculate the drop position from mouse Y coordinate
 */
export function calculateDropMinutes(
  mouseY: number,
  gridTop: number,
  startHour: number,
  offsetMinutes: number
): SnapResult {
  const yInGrid = mouseY - gridTop;
  const rawMinutes = (yInGrid / HOUR_HEIGHT) * 60 + (startHour * 60);
  const adjustedMinutes = rawMinutes - offsetMinutes;
  const snappedMinutes = snapTo15Minutes(adjustedMinutes);
  const clampedMinutes = clampMinutes(snappedMinutes, startHour);
  
  // Convert back to pixel position for visual preview
  const topPosition = ((clampedMinutes - startHour * 60) / 60) * HOUR_HEIGHT;
  
  return { snappedMinutes: clampedMinutes, topPosition };
}

/**
 * Calculate booking duration height in pixels
 */
export function getBookingHeight(booking: CrossDockBooking): number {
  const [startH, startM] = booking.startTime.split(':').map(Number);
  const [endH, endM] = booking.endTime.split(':').map(Number);
  const durationMinutes = (endH * 60 + endM) - (startH * 60 + startM);
  return Math.max((durationMinutes / 60) * HOUR_HEIGHT, 32);
}

/**
 * Calculate booking position style based on time
 */
export function getBookingPositionStyle(
  booking: CrossDockBooking,
  startHour: number
): { top: number; height: number } {
  const [sH, sM] = booking.startTime.split(':').map(Number);
  const [eH, eM] = booking.endTime.split(':').map(Number);
  
  const startOffset = ((sH - startHour) * HOUR_HEIGHT) + (sM / 60 * HOUR_HEIGHT);
  const endOffset = ((eH - startHour) * HOUR_HEIGHT) + (eM / 60 * HOUR_HEIGHT);
  const height = Math.max(endOffset - startOffset, 32);
  
  return {
    top: Math.max(0, startOffset),
    height,
  };
}

/**
 * Format minutes as HH:MM string
 */
export function formatTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

/**
 * Custom hook for managing drag-and-drop state with refs to minimize re-renders
 */
export function useDragAndDrop() {
  const dragStateRef = useRef<DragState>({ booking: null, offsetMinutes: 0 });
  const previewElementRef = useRef<HTMLDivElement | null>(null);
  const rafIdRef = useRef<number | null>(null);

  const setDragging = useCallback((booking: CrossDockBooking | null, offsetMinutes = 0) => {
    dragStateRef.current = { booking, offsetMinutes };
  }, []);

  const getDragState = useCallback(() => {
    return dragStateRef.current;
  }, []);

  const updatePreviewPosition = useCallback((top: number, height: number) => {
    // Cancel any pending RAF to prevent stacking
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
    }
    
    rafIdRef.current = requestAnimationFrame(() => {
      if (previewElementRef.current) {
        previewElementRef.current.style.top = `${top}px`;
        previewElementRef.current.style.height = `${height}px`;
        previewElementRef.current.style.display = 'block';
      }
      rafIdRef.current = null;
    });
  }, []);

  const hidePreview = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    if (previewElementRef.current) {
      previewElementRef.current.style.display = 'none';
    }
  }, []);

  const cleanup = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    dragStateRef.current = { booking: null, offsetMinutes: 0 };
  }, []);

  return {
    dragStateRef,
    previewElementRef,
    setDragging,
    getDragState,
    updatePreviewPosition,
    hidePreview,
    cleanup,
  };
}

/**
 * Extract drag data from a drag event
 */
export function extractDragData(e: DragEvent): { booking: CrossDockBooking; offsetMinutes: number } | null {
  const bookingData = e.dataTransfer.getData('bookingData');
  const offsetMinutes = parseInt(e.dataTransfer.getData('offsetMinutes') || '0', 10);
  
  if (!bookingData) return null;
  
  try {
    const booking = JSON.parse(bookingData) as CrossDockBooking;
    return { booking, offsetMinutes };
  } catch {
    return null;
  }
}
