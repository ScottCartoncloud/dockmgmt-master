import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
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
  ChevronRight,
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

const bookingSchema = z.object({
  title: z.string().min(1, 'Booking title is required').max(200),
  pallets: z.number().min(0, 'Pallets must be 0 or greater').optional(),
  truckRego: z.string().max(20).optional(),
  notes: z.string().max(1000).optional(),
  confirmationEmail: z.string().email('Please enter a valid email').max(255),
});

// Generate time slots from 6 AM to 6 PM in 30-minute increments
const generateTimeSlots = (): TimeSlot[] => {
  const slots: TimeSlot[] = [];
  for (let hour = 6; hour < 18; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const startHour = hour.toString().padStart(2, '0');
      const startMin = minute.toString().padStart(2, '0');
      const endMinute = (minute + 30) % 60;
      const endHour = minute + 30 >= 60 ? hour + 1 : hour;
      const endHourStr = endHour.toString().padStart(2, '0');
      const endMinStr = endMinute.toString().padStart(2, '0');
      
      slots.push({
        start: `${startHour}:${startMin}`,
        end: `${endHourStr}:${endMinStr}`,
        label: `${startHour}:${startMin} - ${endHourStr}:${endMinStr}`,
      });
    }
  }
  return slots;
};

const TIME_SLOTS = generateTimeSlots();

export default function CarrierBooking() {
  const { bookingLinkId } = useParams<{ bookingLinkId: string }>();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [carrier, setCarrier] = useState<CarrierInfo | null>(null);
  const [bookedSlots, setBookedSlots] = useState<Set<string>>(new Set());

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

  // Fetch carrier info and reCAPTCHA config
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
          .from('carriers')
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
          TIME_SLOTS.forEach(slot => {
            if (slot.start >= booking.start_time && slot.start < booking.end_time) {
              booked.add(slot.start);
            }
          });
        });
        setBookedSlots(booked);
      }
    };

    fetchBookedSlots();
  }, [selectedDate, carrier]);

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    setSelectedSlot(null);
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
                disabled={(date) => date < new Date() || date.getDay() === 0 || date.getDay() === 6}
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
                  {format(selectedDate, 'EEEE, MMMM d, yyyy')}
                </span>
              </div>
              
              <div className="flex items-center gap-2 text-foreground font-medium">
                <Clock className="w-5 h-5 text-accent" />
                <span>Select a time slot</span>
              </div>

              <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto">
                {TIME_SLOTS.map((slot) => {
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
                  {format(selectedDate, 'MMM d')} • {selectedSlot.label}
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
