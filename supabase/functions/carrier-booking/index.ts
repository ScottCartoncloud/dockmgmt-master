import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BookingRequest {
  recaptchaToken: string;
  tenantId: string;
  carrierId: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  pallets?: number;
  truckRego?: string;
  notes?: string;
  confirmationEmail: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: BookingRequest = await req.json();
    const { recaptchaToken, ...bookingData } = body;

    console.log('Received carrier booking request for:', bookingData.title);

    // Verify reCAPTCHA token
    const recaptchaSecretKey = Deno.env.get('RECAPTCHA_SECRET_KEY');
    if (!recaptchaSecretKey) {
      console.error('RECAPTCHA_SECRET_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const recaptchaResponse = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `secret=${recaptchaSecretKey}&response=${recaptchaToken}`,
    });

    const recaptchaResult = await recaptchaResponse.json();
    console.log('reCAPTCHA verification result:', recaptchaResult);

    if (!recaptchaResult.success) {
      console.warn('reCAPTCHA verification failed:', recaptchaResult['error-codes']);
      return new Response(
        JSON.stringify({ error: 'reCAPTCHA verification failed. Please try again.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with service role for public insert
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify carrier exists and is enabled
    const { data: carrier, error: carrierError } = await supabase
      .from('carriers')
      .select('id, tenant_id, is_booking_link_enabled')
      .eq('id', bookingData.carrierId)
      .single();

    if (carrierError || !carrier) {
      console.error('Carrier not found:', carrierError);
      return new Response(
        JSON.stringify({ error: 'Invalid carrier' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!carrier.is_booking_link_enabled) {
      return new Response(
        JSON.stringify({ error: 'Booking link is disabled' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create the booking
    const { data: booking, error: insertError } = await supabase
      .from('bookings')
      .insert({
        tenant_id: carrier.tenant_id,
        carrier_id: bookingData.carrierId,
        title: bookingData.title,
        date: bookingData.date,
        start_time: bookingData.startTime,
        end_time: bookingData.endTime,
        pallets: bookingData.pallets || null,
        truck_rego: bookingData.truckRego || null,
        notes: bookingData.notes || null,
        confirmation_email: bookingData.confirmationEmail,
        status: 'scheduled',
        dock_door_id: null,
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('Error creating booking:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to create booking' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Booking created successfully:', booking.id);

    return new Response(
      JSON.stringify({ success: true, bookingId: booking.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in carrier-booking function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};

serve(handler);
