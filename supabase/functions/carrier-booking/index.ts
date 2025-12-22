import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

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

const formatTime = (time: string): string => {
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
};

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
};

const sendConfirmationEmail = async (
  resend: Resend,
  to: string,
  booking: {
    title: string;
    date: string;
    startTime: string;
    endTime: string;
    carrierName: string;
    truckRego?: string;
    tenantName?: string;
  }
) => {
  const formattedDate = formatDate(booking.date);
  const formattedTime = `${formatTime(booking.startTime)} - ${formatTime(booking.endTime)}`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Booking Confirmation</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <!-- Header -->
                <tr>
                  <td style="background-color: #1a1a2e; padding: 32px; text-align: center;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">Booking Confirmed</h1>
                  </td>
                </tr>
                
                <!-- Content -->
                <tr>
                  <td style="padding: 32px;">
                    <p style="margin: 0 0 24px; color: #333333; font-size: 16px; line-height: 1.5;">
                      Your delivery booking has been confirmed. Here are the details:
                    </p>
                    
                    <!-- Booking Details Card -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f9fa; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
                      <tr>
                        <td>
                          <table width="100%" cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="padding: 8px 0; border-bottom: 1px solid #e9ecef;">
                                <span style="color: #6c757d; font-size: 14px;">Booking Title</span><br>
                                <span style="color: #333333; font-size: 16px; font-weight: 600;">${booking.title}</span>
                              </td>
                            </tr>
                            <tr>
                              <td style="padding: 8px 0; border-bottom: 1px solid #e9ecef;">
                                <span style="color: #6c757d; font-size: 14px;">Date</span><br>
                                <span style="color: #333333; font-size: 16px; font-weight: 600;">${formattedDate}</span>
                              </td>
                            </tr>
                            <tr>
                              <td style="padding: 8px 0; border-bottom: 1px solid #e9ecef;">
                                <span style="color: #6c757d; font-size: 14px;">Time</span><br>
                                <span style="color: #333333; font-size: 16px; font-weight: 600;">${formattedTime}</span>
                              </td>
                            </tr>
                            <tr>
                              <td style="padding: 8px 0;${booking.truckRego ? ' border-bottom: 1px solid #e9ecef;' : ''}">
                                <span style="color: #6c757d; font-size: 14px;">Carrier</span><br>
                                <span style="color: #333333; font-size: 16px; font-weight: 600;">${booking.carrierName}</span>
                              </td>
                            </tr>
                            ${booking.truckRego ? `
                            <tr>
                              <td style="padding: 8px 0;${booking.tenantName ? ' border-bottom: 1px solid #e9ecef;' : ''}">
                                <span style="color: #6c757d; font-size: 14px;">Truck Rego</span><br>
                                <span style="color: #333333; font-size: 16px; font-weight: 600;">${booking.truckRego}</span>
                              </td>
                            </tr>
                            ` : ''}
                            ${booking.tenantName ? `
                            <tr>
                              <td style="padding: 8px 0;">
                                <span style="color: #6c757d; font-size: 14px;">Warehouse</span><br>
                                <span style="color: #333333; font-size: 16px; font-weight: 600;">${booking.tenantName}</span>
                              </td>
                            </tr>
                            ` : ''}
                          </table>
                        </td>
                      </tr>
                    </table>
                    
                    <p style="margin: 0; color: #6c757d; font-size: 14px; line-height: 1.5;">
                      If you need to make any changes to your booking, please contact the warehouse directly.
                    </p>
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="background-color: #f8f9fa; padding: 24px; text-align: center; border-top: 1px solid #e9ecef;">
                    <p style="margin: 0; color: #6c757d; font-size: 12px;">
                      This is an automated confirmation email. Please do not reply.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

  try {
    const result = await resend.emails.send({
      from: 'Dock Scheduler <onboarding@resend.dev>',
      to: [to],
      subject: `Booking Confirmed: ${booking.title} on ${formattedDate}`,
      html,
    });
    console.log('Confirmation email sent:', result);
    return result;
  } catch (error) {
    console.error('Failed to send confirmation email:', error);
    throw error;
  }
};

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

    // Verify carrier exists and is enabled, also get carrier name
    const { data: carrier, error: carrierError } = await supabase
      .from('carriers')
      .select('id, tenant_id, is_booking_link_enabled, name, email')
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

    // Get tenant name for email
    const { data: tenant } = await supabase
      .from('tenants')
      .select('name')
      .eq('id', carrier.tenant_id)
      .single();

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

    // Send confirmation email
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (resendApiKey) {
      const resend = new Resend(resendApiKey);
      
      // Collect all email recipients
      const emailRecipients: string[] = [bookingData.confirmationEmail];
      
      // Add carrier email if different from confirmation email
      if (carrier.email && carrier.email !== bookingData.confirmationEmail) {
        emailRecipients.push(carrier.email);
      }

      const emailDetails = {
        title: bookingData.title,
        date: bookingData.date,
        startTime: bookingData.startTime,
        endTime: bookingData.endTime,
        carrierName: carrier.name,
        truckRego: bookingData.truckRego,
        tenantName: tenant?.name,
      };

      // Send emails to all recipients
      for (const recipient of emailRecipients) {
        try {
          await sendConfirmationEmail(resend, recipient, emailDetails);
          console.log(`Confirmation email sent to: ${recipient}`);
        } catch (emailError) {
          console.error(`Failed to send email to ${recipient}:`, emailError);
          // Don't fail the booking if email fails
        }
      }
    } else {
      console.warn('RESEND_API_KEY not configured, skipping confirmation email');
    }

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
