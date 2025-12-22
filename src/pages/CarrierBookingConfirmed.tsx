import { useLocation, useParams, Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Calendar, Clock, FileText, Truck } from 'lucide-react';
import cartonCloudLogo from '@/assets/cartoncloud-logo.png';

interface ConfirmationState {
  carrierName: string;
  date: string;
  time: string;
  title: string;
}

export default function CarrierBookingConfirmed() {
  const { bookingLinkId } = useParams<{ bookingLinkId: string }>();
  const location = useLocation();
  const state = location.state as ConfirmationState | null;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-header p-4">
      <Card className="w-full max-w-md border-0 shadow-2xl">
        <CardContent className="pt-8 pb-6 text-center">
          {/* Header */}
          <div className="mb-6">
            <img 
              src={cartonCloudLogo} 
              alt="CartonCloud" 
              className="h-10 mx-auto mb-3"
            />
          </div>

          {/* Success Icon */}
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>

          <h1 className="text-2xl font-bold text-foreground mb-2">
            Booking Confirmed!
          </h1>
          <p className="text-muted-foreground mb-6">
            Thank you for your booking. A confirmation email will be sent shortly.
          </p>

          {state && (
            <div className="bg-muted rounded-lg p-4 text-left space-y-3 mb-6">
              <div className="flex items-center gap-3">
                <Truck className="w-5 h-5 text-accent flex-shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Carrier</p>
                  <p className="font-medium text-foreground">{state.carrierName}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-accent flex-shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Booking</p>
                  <p className="font-medium text-foreground">{state.title}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-accent flex-shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Date</p>
                  <p className="font-medium text-foreground">{state.date}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-accent flex-shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Time</p>
                  <p className="font-medium text-foreground">{state.time}</p>
                </div>
              </div>
            </div>
          )}

          <Button asChild className="w-full">
            <Link to={`/carrier/${bookingLinkId}`}>
              Book Another Delivery
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
