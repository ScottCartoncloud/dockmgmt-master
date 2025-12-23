import { toZonedTime, fromZonedTime, format as formatTz } from 'date-fns-tz';
import { format, parse, getDay, setHours, setMinutes } from 'date-fns';

/**
 * Convert a UTC date to the tenant's timezone
 * Use this when displaying dates from the database
 */
export function toTenantTime(utcDate: Date, tenantTimezone: string): Date {
  return toZonedTime(utcDate, tenantTimezone);
}

/**
 * Convert a local date in tenant timezone to UTC
 * Use this when storing dates to the database
 */
export function fromTenantTime(localDate: Date, tenantTimezone: string): Date {
  return fromZonedTime(localDate, tenantTimezone);
}

/**
 * Format a date in the tenant's timezone
 */
export function formatInTenantTimezone(
  date: Date,
  formatStr: string,
  tenantTimezone: string
): string {
  return formatTz(date, formatStr, { timeZone: tenantTimezone });
}

/**
 * Parse a time string (HH:mm) into hours and minutes
 */
export function parseTimeString(timeStr: string): { hours: number; minutes: number } {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return { hours: hours || 0, minutes: minutes || 0 };
}

/**
 * Convert a time string (HH:mm) to total minutes since midnight
 */
export function timeStringToMinutes(timeStr: string): number {
  const { hours, minutes } = parseTimeString(timeStr);
  return hours * 60 + minutes;
}

/**
 * Convert total minutes since midnight to a time string (HH:mm)
 */
export function minutesToTimeString(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

/**
 * Check if a given hour falls within working hours for a specific day
 */
export function isHourWithinWorkingHours(
  hour: number,
  dayOfWeek: number,
  workingHours: Array<{ day_of_week: number; enabled: boolean; start_time: string; end_time: string }>
): boolean {
  const dayConfig = workingHours.find(wh => wh.day_of_week === dayOfWeek);
  
  if (!dayConfig || !dayConfig.enabled) {
    return false;
  }
  
  const startMinutes = timeStringToMinutes(dayConfig.start_time);
  const endMinutes = timeStringToMinutes(dayConfig.end_time);
  const hourMinutes = hour * 60;
  
  // Hour is within working hours if its start is >= working start and < working end
  return hourMinutes >= startMinutes && hourMinutes < endMinutes;
}

/**
 * Check if a specific time (HH:mm) falls within working hours for a specific day
 */
export function isTimeWithinWorkingHours(
  timeStr: string,
  dayOfWeek: number,
  workingHours: Array<{ day_of_week: number; enabled: boolean; start_time: string; end_time: string }>
): boolean {
  const dayConfig = workingHours.find(wh => wh.day_of_week === dayOfWeek);
  
  if (!dayConfig || !dayConfig.enabled) {
    return false;
  }
  
  const timeMinutes = timeStringToMinutes(timeStr);
  const startMinutes = timeStringToMinutes(dayConfig.start_time);
  const endMinutes = timeStringToMinutes(dayConfig.end_time);
  
  return timeMinutes >= startMinutes && timeMinutes <= endMinutes;
}

/**
 * Check if a booking time range is within working hours
 */
export function isBookingWithinWorkingHours(
  date: Date,
  startTime: string,
  endTime: string,
  workingHours: Array<{ day_of_week: number; enabled: boolean; start_time: string; end_time: string }>
): { valid: boolean; reason?: string } {
  const dayOfWeek = getDay(date);
  const dayConfig = workingHours.find(wh => wh.day_of_week === dayOfWeek);
  
  if (!dayConfig || !dayConfig.enabled) {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return { 
      valid: false, 
      reason: `${dayNames[dayOfWeek]} is not a working day for your organisation.` 
    };
  }
  
  const bookingStartMinutes = timeStringToMinutes(startTime);
  const bookingEndMinutes = timeStringToMinutes(endTime);
  const workStartMinutes = timeStringToMinutes(dayConfig.start_time);
  const workEndMinutes = timeStringToMinutes(dayConfig.end_time);
  
  if (bookingStartMinutes < workStartMinutes) {
    return {
      valid: false,
      reason: `Start time is before working hours begin (${dayConfig.start_time}).`
    };
  }
  
  if (bookingEndMinutes > workEndMinutes) {
    return {
      valid: false,
      reason: `End time is after working hours end (${dayConfig.end_time}).`
    };
  }
  
  return { valid: true };
}

/**
 * Check if a day of week is a working day
 */
export function isWorkingDay(
  dayOfWeek: number,
  workingHours: Array<{ day_of_week: number; enabled: boolean }>
): boolean {
  const dayConfig = workingHours.find(wh => wh.day_of_week === dayOfWeek);
  return dayConfig?.enabled ?? false;
}

/**
 * Get working hours for a specific day
 */
export function getWorkingHoursForDay(
  dayOfWeek: number,
  workingHours: Array<{ day_of_week: number; enabled: boolean; start_time: string; end_time: string }>
): { enabled: boolean; start_time: string; end_time: string } | null {
  return workingHours.find(wh => wh.day_of_week === dayOfWeek) || null;
}

/**
 * Generate time options for a select dropdown, optionally filtered by working hours
 */
export function generateTimeOptions(
  intervalMinutes: number = 15,
  dayOfWeek?: number,
  workingHours?: Array<{ day_of_week: number; enabled: boolean; start_time: string; end_time: string }>,
  includeOutsideHours: boolean = false
): Array<{ value: string; label: string; disabled: boolean }> {
  const options: Array<{ value: string; label: string; disabled: boolean }> = [];
  
  for (let minutes = 0; minutes < 24 * 60; minutes += intervalMinutes) {
    const timeStr = minutesToTimeString(minutes);
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    // Format label as 12-hour time
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    const label = `${displayHours}:${mins.toString().padStart(2, '0')} ${period}`;
    
    let disabled = false;
    
    if (dayOfWeek !== undefined && workingHours && workingHours.length > 0) {
      const isWithin = isTimeWithinWorkingHours(timeStr, dayOfWeek, workingHours);
      disabled = !isWithin;
    }
    
    if (!disabled || includeOutsideHours) {
      options.push({ value: timeStr, label, disabled });
    }
  }
  
  return options;
}
