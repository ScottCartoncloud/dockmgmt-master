import { useMemo, useCallback } from 'react';
import { getDay } from 'date-fns';
import { useOrganisationSettings, WorkingHours } from './useOrganisationSettings';
import {
  isHourWithinWorkingHours,
  isTimeWithinWorkingHours,
  isBookingWithinWorkingHours,
  isWorkingDay,
  getWorkingHoursForDay,
  timeStringToMinutes,
} from '@/lib/timezoneUtils';

export interface UseWorkingHoursReturn {
  timezone: string;
  workingHours: WorkingHours[];
  isLoading: boolean;
  
  // Check functions
  isHourWorking: (hour: number, dayOfWeek: number) => boolean;
  isTimeWorking: (timeStr: string, dayOfWeek: number) => boolean;
  isDayWorking: (dayOfWeek: number) => boolean;
  isDateWorking: (date: Date) => boolean;
  validateBooking: (date: Date, startTime: string, endTime: string) => { valid: boolean; reason?: string };
  
  // Get working hours for a day
  getHoursForDay: (dayOfWeek: number) => { enabled: boolean; start_time: string; end_time: string } | null;
  
  // Get start/end hour numbers for calendar rendering
  getWorkingHourRange: (dayOfWeek: number) => { startHour: number; endHour: number } | null;
}

export function useWorkingHours(): UseWorkingHoursReturn {
  const { timezone, workingHours, isLoading } = useOrganisationSettings();

  const isHourWorking = useCallback((hour: number, dayOfWeek: number): boolean => {
    if (!workingHours || workingHours.length === 0) return true; // No config = all hours working
    return isHourWithinWorkingHours(hour, dayOfWeek, workingHours);
  }, [workingHours]);

  const isTimeWorking = useCallback((timeStr: string, dayOfWeek: number): boolean => {
    if (!workingHours || workingHours.length === 0) return true;
    return isTimeWithinWorkingHours(timeStr, dayOfWeek, workingHours);
  }, [workingHours]);

  const isDayWorking = useCallback((dayOfWeek: number): boolean => {
    if (!workingHours || workingHours.length === 0) return true;
    return isWorkingDay(dayOfWeek, workingHours);
  }, [workingHours]);

  const isDateWorking = useCallback((date: Date): boolean => {
    const dayOfWeek = getDay(date);
    return isDayWorking(dayOfWeek);
  }, [isDayWorking]);

  const validateBooking = useCallback((date: Date, startTime: string, endTime: string): { valid: boolean; reason?: string } => {
    if (!workingHours || workingHours.length === 0) return { valid: true };
    return isBookingWithinWorkingHours(date, startTime, endTime, workingHours);
  }, [workingHours]);

  const getHoursForDay = useCallback((dayOfWeek: number) => {
    if (!workingHours || workingHours.length === 0) return null;
    return getWorkingHoursForDay(dayOfWeek, workingHours);
  }, [workingHours]);

  const getWorkingHourRange = useCallback((dayOfWeek: number): { startHour: number; endHour: number } | null => {
    const config = getHoursForDay(dayOfWeek);
    if (!config || !config.enabled) return null;
    
    const startMinutes = timeStringToMinutes(config.start_time);
    const endMinutes = timeStringToMinutes(config.end_time);
    
    return {
      startHour: Math.floor(startMinutes / 60),
      endHour: Math.ceil(endMinutes / 60),
    };
  }, [getHoursForDay]);

  return {
    timezone,
    workingHours,
    isLoading,
    isHourWorking,
    isTimeWorking,
    isDayWorking,
    isDateWorking,
    validateBooking,
    getHoursForDay,
    getWorkingHourRange,
  };
}
