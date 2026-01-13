import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WorkingHoursResponse {
  timezone: string | null;
  workingHours: Array<{
    day_of_week: number;
    enabled: boolean;
    start_time: string;
    end_time: string;
  }>;
}

// Default working hours (Mon-Fri 08:00-17:00, Sat-Sun disabled)
// Matches Organisation Settings defaults
const DEFAULT_WORKING_HOURS = [
  { day_of_week: 0, enabled: false, start_time: '08:00:00', end_time: '17:00:00' }, // Sunday
  { day_of_week: 1, enabled: true, start_time: '08:00:00', end_time: '17:00:00' },  // Monday
  { day_of_week: 2, enabled: true, start_time: '08:00:00', end_time: '17:00:00' },  // Tuesday
  { day_of_week: 3, enabled: true, start_time: '08:00:00', end_time: '17:00:00' },  // Wednesday
  { day_of_week: 4, enabled: true, start_time: '08:00:00', end_time: '17:00:00' },  // Thursday
  { day_of_week: 5, enabled: true, start_time: '08:00:00', end_time: '17:00:00' },  // Friday
  { day_of_week: 6, enabled: false, start_time: '08:00:00', end_time: '17:00:00' }, // Saturday
];

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    let bookingLinkId = url.searchParams.get('bookingLinkId');

    // Also accept bookingLinkId from request body for POST requests
    if (!bookingLinkId && req.method === 'POST') {
      try {
        const body = await req.json();
        bookingLinkId = body.bookingLinkId;
      } catch {
        // Ignore JSON parse errors
      }
    }

    if (!bookingLinkId) {
      return new Response(
        JSON.stringify({ error: 'Missing bookingLinkId parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with service role for public access
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get carrier by booking link ID to find tenant
    const { data: carrier, error: carrierError } = await supabase
      .from('carriers')
      .select('tenant_id, is_booking_link_enabled')
      .eq('booking_link_id', bookingLinkId)
      .single();

    if (carrierError || !carrier) {
      console.error('Carrier not found:', carrierError);
      return new Response(
        JSON.stringify({ error: 'Invalid booking link' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!carrier.is_booking_link_enabled) {
      return new Response(
        JSON.stringify({ error: 'Booking link is disabled' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch tenant timezone and working hours in parallel
    const [tenantResult, workingHoursResult] = await Promise.all([
      supabase
        .from('tenants')
        .select('timezone')
        .eq('id', carrier.tenant_id)
        .single(),
      supabase
        .from('tenant_working_hours')
        .select('day_of_week, enabled, start_time, end_time')
        .eq('tenant_id', carrier.tenant_id)
        .order('day_of_week'),
    ]);

    if (tenantResult.error) {
      console.error('Error fetching tenant:', tenantResult.error);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch organisation settings' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use default working hours if none configured
    const workingHours = workingHoursResult.data && workingHoursResult.data.length > 0
      ? workingHoursResult.data
      : DEFAULT_WORKING_HOURS;

    const response: WorkingHoursResponse = {
      timezone: tenantResult.data?.timezone || null,
      workingHours,
    };

    console.log(`Fetched working hours for booking link ${bookingLinkId}:`, {
      hasConfiguredHours: workingHoursResult.data && workingHoursResult.data.length > 0,
      usingDefaults: !workingHoursResult.data || workingHoursResult.data.length === 0,
      response,
    });

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in carrier-working-hours function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};

serve(handler);
