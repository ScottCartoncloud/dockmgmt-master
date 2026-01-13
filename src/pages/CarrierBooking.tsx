import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format, getDay } from 'date-fns';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ReCaptcha } from '@/components/ReCaptcha';
import { 
  Loader2, 
  Calendar as CalendarIcon, 
  Clock, 
  FileText, 
  CheckCircle2, 
  AlertCircle,
  ChevronLeft,
  Truck
} from 'lucide-react';
import cartonCloudLogo from '@/assets/cartoncloud-logo.png';

interface CarrierInfo {
  id: string;
  name: string;
  tenant_id: string;
  is_booking_link_enabled: boolean;
}

interface TimeSlot {
  start: string;
  end: string;
  label: string;
}

interface WorkingHoursConfig {
  day_of_week: number;
  enabled: boolean;
  start_time: string;
  end_time: string;
}

interface OrganisationSettings {
  timezone: string | null;
  workingHours: WorkingHoursConfig[];
}

const bookingSchema = z.object({
  title: z.string().min(1, 'Booking title is required').max(200),
  pallets: z.number().min(0, 'Pallets must be 0 or greater').optional(),
  truckRego: z.string().max(20).optional(),
  notes: z.string().max(1000).optional(),
  confirmationEmail: z.string().email('Please enter a valid email').max(255),
});

// Default fallback hours (6 AM to 6 PM) if no org settings exist
const DEFAULT_START_TIME = '06:00';
const DEFAULT_END_TIME = '18:00';

// Generate time slots based on working hours for a specific day
const generateTimeSlotsForDay = (
  dayOfWeek: number,
  workingHours: WorkingHoursConfig[]
): TimeSlot[] => {
  const slots: TimeSlot[] = [];
  
  // Find the config for this day
  const dayConfig = workingHours.find(wh => wh.day_of_week === dayOfWeek);
  
  // Determine start and end times
  let startTime = DEFAULT_START_TIME;
  let endTime = DEFAULT_END_TIME;
  
  if (dayConfig && dayConfig.enabled) {
    // Times are already normalized to HH:MM format when stored in state
    startTime = dayConfig.start_time;
    endTime = dayConfig.end_time;
  } else if (dayConfig && !dayConfig.enabled) {
    // Day is disabled, return empty slots
    return [];
  }
  // If no config exists, use defaults (all days enabled)
  
  // Parse times (now guaranteed to be HH:MM format)
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);
  
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  
  // Generate 30-minute slots within working hours
  for (let minutes = startMinutes; minutes < endMinutes; minutes += 30) {
    const slotEndMinutes = minutes + 30;
    
    // Ensure the slot ends within working hours
    if (slotEndMinutes > endMinutes) break;
    
    const slotStartHour = Math.floor(minutes / 60);
    const slotStartMin = minutes % 60;
    const slotEndHour = Math.floor(slotEndMinutes / 60);
    const slotEndMin = slotEndMinutes % 60;
    
    const startStr = `${slotStartHour.toString().padStart(2, '0')}:${slotStartMin.toString().padStart(2, '0')}`;
    const endStr = `${slotEndHour.toString().padStart(2, '0')}:${slotEndMin.toString().padStart(2, '0')}`;
    
    slots.push({
      start: startStr,
      end: endStr,
      label: `${startStr} - ${endStr}`,
    });
  }
  
  return slots;
};

// Check if a day is a working day
const isDayWorking = (dayOfWeek: number, workingHours: WorkingHoursConfig[]): boolean => {
  // If no working hours configured, default to Mon-Fri
  if (workingHours.length === 0) {
    return dayOfWeek >= 1 && dayOfWeek <= 5;
  }
  
  const dayConfig = workingHours.find(wh => wh.day_of_week === dayOfWeek);
  return dayConfig?.enabled ?? false;
};

export default function CarrierBooking() {
  const { bookingLinkId } = useParams<{ bookingLinkId: string }>();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [carrier, setCarrier] = useState<CarrierInfo | null>(null);
  const [bookedSlots, setBookedSlots] = useState<Set<string>>(new Set());
  const [orgSettings, setOrgSettings] = useState<OrganisationSettings | null>(null);

  // Form state
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [title, setTitle] = useState('');
  const [pallets, setPallets] = useState('');
  const [truckRego, setTruckRego] = useState('');
  const [notes, setNotes] = useState('');
  const [confirmationEmail, setConfirmationEmail] = useState('');
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null);
  const [recaptchaSiteKey, setRecaptchaSiteKey] = useState<string>('');

  // Generate time slots for the selected date based on working hours
  const timeSlots = useMemo(() => {
    if (!selectedDate || !orgSettings) return [];
    const dayOfWeek = getDay(selectedDate);
    return generateTimeSlotsForDay(dayOfWeek, orgSettings.workingHours);
  }, [selectedDate, orgSettings]);

  // Fetch carrier info, reCAPTCHA config, and working hours
  useEffect(() => {
    const fetchData = async () => {
      if (!bookingLinkId) {
        setError('Invalid booking link');
        setIsLoading(false);
        return;
      }

      // Fetch carrier and reCAPTCHA config in parallel
      const [carrierResult, recaptchaResult] = await Promise.all([
        supabase
          .from('carriers_public')
          .select('id, name, tenant_id, is_booking_link_enabled')
          .eq('booking_link_id', bookingLinkId)
          .maybeSingle(),
        supabase.functions.invoke('recaptcha-config'),
      ]);

      // Handle carrier
      if (carrierResult.error) {
        console.error('Error fetching carrier:', carrierResult.error);
        setError('Unable to load booking page');
        setIsLoading(false);
        return;
      }

      if (!carrierResult.data) {
        setError('This booking link is invalid or has expired');
        setIsLoading(false);
        return;
      }

      if (!carrierResult.data.is_booking_link_enabled) {
        setError('This booking link has been disabled. Please contact the carrier.');
        setIsLoading(false);
        return;
      }

      setCarrier(carrierResult.data);

      // Handle reCAPTCHA config
      if (recaptchaResult.data?.siteKey) {
        setRecaptchaSiteKey(recaptchaResult.data.siteKey);
      }

      // Fetch working hours via edge function
      try {
        console.log('Fetching working hours for booking link:', bookingLinkId);
        const { data: workingHoursData, error: workingHoursError } = await supabase.functions.invoke('carrier-working-hours', {
          body: { bookingLinkId },
        });
        
        console.log('Working hours raw response:', { data: workingHoursData, error: workingHoursError });
        
        if (workingHoursError) {
          console.warn('Failed to fetch working hours:', workingHoursError);
          setOrgSettings({ timezone: null, workingHours: [] });
        } else if (workingHoursData) {
          // Normalize time format from HH:MM:SS to HH:MM
          const normalizedWorkingHours: WorkingHoursConfig[] = (workingHoursData.workingHours || []).map((wh: { day_of_week: number; enabled: boolean; start_time: string; end_time: string }) => ({
            day_of_week: wh.day_of_week,
            enabled: wh.enabled,
            start_time: wh.start_time.substring(0, 5), // "08:00:00" -> "08:00"
            end_time: wh.end_time.substring(0, 5),     // "17:00:00" -> "17:00"
          }));
          
          console.log('Normalized working hours:', normalizedWorkingHours);
          
          setOrgSettings({
            timezone: workingHoursData.timezone || null,
            workingHours: normalizedWorkingHours,
          });
        } else {
          console.warn('No working hours data in response');
          setOrgSettings({ timezone: null, workingHours: [] });
        }
      } catch (err) {
        console.warn('Error fetching working hours:', err);
        setOrgSettings({ timezone: null, workingHours: [] });
      }

      setIsLoading(false);
    };

    fetchData();
  }, [bookingLinkId]);

  // Fetch booked slots when date changes
  useEffect(() => {
    const fetchBookedSlots = async () => {
      if (!selectedDate || !carrier) return;

      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const { data } = await supabase
        .from('bookings')
        .select('start_time, end_time')
        .eq('tenant_id', carrier.tenant_id)
        .eq('date', dateStr)
        .neq('status', 'cancelled');

      if (data) {
        const booked = new Set<string>();
        data.forEach(booking => {
          // Mark all slots that overlap with this booking as booked
          timeSlots.forEach(slot => {
            if (slot.start >= booking.start_time && slot.start < booking.end_time) {
              booked.add(slot.start);
            }
          });
        });
        setBookedSlots(booked);
      }
    };

    fetchBookedSlots();
  }, [selectedDate, carrier, timeSlots]);

  // Function to check if a date should be disabled
  const isDateDisabled = (date: Date): boolean => {
    // Disable past dates
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date < today) return true;
    
    // Check if day is a working day
    if (!orgSettings) return false;
    
    const dayOfWeek = getDay(date);
    return !isDayWorking(dayOfWeek, orgSettings.workingHours);
  };

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    setSelectedSlot(null);
    setBookedSlots(new Set()); // Reset booked slots when date changes
    if (date) {
      setStep(2);
    }
  };

  const handleSlotSelect = (slot: TimeSlot) => {
    setSelectedSlot(slot);
    setStep(3);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!carrier || !selectedDate || !selectedSlot) {
      setError('Please complete all steps');
      return;
    }

    if (!recaptchaToken) {
      setError('Please complete the reCAPTCHA verification');
      return;
    }

    const validation = bookingSchema.safeParse({
      title,
      pallets: pallets ? parseInt(pallets, 10) : undefined,
      truckRego: truckRego || undefined,
      notes: notes || undefined,
      confirmationEmail,
    });

    if (!validation.success) {
      setError(validation.error.errors[0].message);
      return;
    }

    setIsSubmitting(true);

    // Use edge function with reCAPTCHA verification
    const { data, error: submitError } = await supabase.functions.invoke('carrier-booking', {
      body: {
        recaptchaToken,
        tenantId: carrier.tenant_id,
        carrierId: carrier.id,
        title,
        date: format(selectedDate, 'yyyy-MM-dd'),
        startTime: selectedSlot.start,
        endTime: selectedSlot.end,
        pallets: pallets ? parseInt(pallets, 10) : undefined,
        truckRego: truckRego || undefined,
        notes: notes || undefined,
        confirmationEmail,
      },
    });

    setIsSubmitting(false);

    if (submitError || !data?.success) {
      console.error('Error creating booking:', submitError || data?.error);
      setError(data?.error || 'Unable to create booking. Please try again.');
      setRecaptchaToken(null); // Reset reCAPTCHA on error
      return;
    }

    // Navigate to confirmation
    navigate(`/carrier/${bookingLinkId}/confirmed`, {
      state: {
        carrierName: carrier.name,
        date: format(selectedDate, 'EEEE, MMMM d, yyyy'),
        time: selectedSlot.label,
        title,
      },
    });
  };

  const goBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  // Format date for display using org timezone if available
  const formatDisplayDate = (date: Date, formatStr: string): string => {
    if (orgSettings?.timezone) {
      try {
        return formatInTimeZone(date, orgSettings.timezone, formatStr);
      } catch {
        return format(date, formatStr);
      }
    }
    return format(date, formatStr);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-header">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    );
  }

  if (error && !carrier) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-header p-4">
        <Card className="w-full max-w-md border-0 shadow-2xl">
          <CardContent className="pt-8 pb-6 text-center">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h1 className="text-xl font-bold text-foreground mb-2">Unable to Load</h1>
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-header p-4">
      <Card className="w-full max-w-lg border-0 shadow-2xl">
        <CardContent className="pt-8 pb-6">
          {/* Header */}
          <div className="mb-6 text-center">
            <img 
              src={cartonCloudLogo} 
              alt="CartonCloud" 
              className="h-10 mx-auto mb-3"
            />
            <h1 className="text-2xl font-bold text-foreground mb-1">Book a Delivery</h1>
            <p className="text-muted-foreground text-sm flex items-center justify-center gap-2">
              <Truck className="w-4 h-4" />
              {carrier?.name}
            </p>
            {orgSettings?.timezone && (
              <p className="text-xs text-muted-foreground mt-1">
                All times shown in {orgSettings.timezone.replace(/_/g, ' ')}
              </p>
            )}
          </div>

          {/* Progress Steps */}
          <div className="flex items-center justify-center gap-2 mb-6">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`flex items-center gap-2 ${s < 3 ? 'flex-1' : ''}`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                    step >= s
                      ? 'bg-accent text-accent-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {step > s ? <CheckCircle2 className="w-4 h-4" /> : s}
                </div>
                {s < 3 && (
                  <div
                    className={`flex-1 h-1 rounded ${
                      step > s ? 'bg-accent' : 'bg-muted'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Step Labels */}
          <div className="flex justify-between text-xs text-muted-foreground mb-6 px-2">
            <span className={step === 1 ? 'text-accent font-medium' : ''}>Select Date</span>
            <span className={step === 2 ? 'text-accent font-medium' : ''}>Select Time</span>
            <span className={step === 3 ? 'text-accent font-medium' : ''}>Details</span>
          </div>

          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Step 1: Select Date */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-foreground font-medium">
                <CalendarIcon className="w-5 h-5 text-accent" />
                <span>Choose a date for your delivery</span>
              </div>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={handleDateSelect}
                disabled={isDateDisabled}
                className="rounded-md border mx-auto"
              />
            </div>
          )}

          {/* Step 2: Select Time */}
          {step === 2 && selectedDate && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Button variant="ghost" size="sm" onClick={goBack} className="gap-1">
                  <ChevronLeft className="w-4 h-4" />
                  Back
                </Button>
                <span className="text-sm text-muted-foreground">
                  {formatDisplayDate(selectedDate, 'EEEE, MMMM d, yyyy')}
                </span>
              </div>
              
              <div className="flex items-center gap-2 text-foreground font-medium">
                <Clock className="w-5 h-5 text-accent" />
                <span>Select a time slot</span>
              </div>

              {timeSlots.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2" />
                  <p>No available time slots for this date.</p>
                  <Button variant="link" onClick={goBack} className="mt-2">
                    Choose a different date
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto">
                  {timeSlots.map((slot) => {
                    const isBooked = bookedSlots.has(slot.start);
                    return (
                      <Button
                        key={slot.start}
                        variant={selectedSlot?.start === slot.start ? 'default' : 'outline'}
                        className={`text-sm ${isBooked ? 'opacity-50 cursor-not-allowed' : ''}`}
                        disabled={isBooked}
                        onClick={() => handleSlotSelect(slot)}
                      >
                        {slot.label}
                      </Button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Booking Details */}
          {step === 3 && selectedDate && selectedSlot && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex items-center justify-between">
                <Button variant="ghost" size="sm" onClick={goBack} className="gap-1">
                  <ChevronLeft className="w-4 h-4" />
                  Back
                </Button>
                <span className="text-sm text-muted-foreground">
                  {formatDisplayDate(selectedDate, 'MMM d')} • {selectedSlot.label}
                </span>
              </div>

              <div className="flex items-center gap-2 text-foreground font-medium">
                <FileText className="w-5 h-5 text-accent" />
                <span>Enter booking details</span>
              </div>

              <div className="space-y-2">
                <Label htmlFor="title">Booking Title *</Label>
                <Input
                  id="title"
                  placeholder="e.g., Inbound Shipment #1234"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="pallets"># of Pallets</Label>
                  <Input
                    id="pallets"
                    type="number"
                    min="0"
                    placeholder="0"
                    value={pallets}
                    onChange={(e) => setPallets(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="truckRego">Truck Rego</Label>
                  <Input
                    id="truckRego"
                    placeholder="ABC123"
                    value={truckRego}
                    onChange={(e) => setTruckRego(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes (optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Any special instructions..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmationEmail">Confirmation Email *</Label>
                <Input
                  id="confirmationEmail"
                  type="email"
                  placeholder="your@email.com"
                  value={confirmationEmail}
                  onChange={(e) => setConfirmationEmail(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  We'll send booking confirmation to this email.
                </p>
              </div>

              {/* reCAPTCHA */}
              {recaptchaSiteKey && (
                <div className="space-y-2">
                  <ReCaptcha
                    siteKey={recaptchaSiteKey}
                    onVerify={(token) => setRecaptchaToken(token)}
                    onExpire={() => setRecaptchaToken(null)}
                    onError={() => setRecaptchaToken(null)}
                  />
                </div>
              )}

              <Button 
                type="submit" 
                className="w-full" 
                disabled={isSubmitting || (recaptchaSiteKey && !recaptchaToken)}
              >
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirm Booking
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
