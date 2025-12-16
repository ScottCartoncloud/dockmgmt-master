import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CARTONCLOUD_API_BASE = 'https://api.cartoncloud.com';

interface TokenCache {
  accessToken: string;
  expiresAt: number;
}

let tokenCache: TokenCache | null = null;

async function getAccessToken(clientId: string, clientSecret: string): Promise<string> {
  // Check if we have a valid cached token
  if (tokenCache && Date.now() < tokenCache.expiresAt - 60000) { // 1 minute buffer
    console.log('Using cached access token');
    return tokenCache.accessToken;
  }

  console.log('Fetching new access token from CartonCloud');
  const credentials = btoa(`${clientId}:${clientSecret}`);
  
  const response = await fetch(`${CARTONCLOUD_API_BASE}/uaa/oauth/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Accept-Version': '1',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Token fetch failed:', response.status, errorText);
    throw new Error(`Failed to get access token: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  console.log('Access token obtained, expires in:', data.expires_in, 'seconds');
  
  tokenCache = {
    accessToken: data.access_token,
    expiresAt: Date.now() + (data.expires_in * 1000),
  };

  return data.access_token;
}

async function searchInboundOrders(
  accessToken: string,
  tenantId: string,
  searchTerm: string
): Promise<any[]> {
  console.log('Searching inbound orders for:', searchTerm);
  
  const searchPayload = {
    condition: {
      type: 'OrCondition',
      conditions: [
        {
          type: 'TextComparisonCondition',
          field: { type: 'ValueField', value: 'reference' },
          value: { type: 'ValueField', value: searchTerm },
          method: 'STARTS_WITH',
        },
        {
          type: 'TextComparisonCondition',
          field: { type: 'ValueField', value: 'customerName' },
          value: { type: 'ValueField', value: searchTerm },
          method: 'STARTS_WITH',
        },
      ],
    },
  };

  const response = await fetch(
    `${CARTONCLOUD_API_BASE}/tenants/${tenantId}/inbound-orders/search`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept-Version': '1',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(searchPayload),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Search failed:', response.status, errorText);
    throw new Error(`Search failed: ${response.status} - ${errorText}`);
  }

  const results = await response.json();
  console.log('Search returned', results.length, 'results');
  return results;
}

async function testConnection(
  clientId: string,
  clientSecret: string,
  tenantId: string
): Promise<{ success: boolean; message: string; userInfo?: any }> {
  try {
    const accessToken = await getAccessToken(clientId, clientSecret);
    
    // Test by getting user info
    const response = await fetch(`${CARTONCLOUD_API_BASE}/uaa/userinfo`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept-Version': '1',
      },
    });

    if (!response.ok) {
      throw new Error(`User info request failed: ${response.status}`);
    }

    const userInfo = await response.json();
    console.log('Connection test successful, user:', userInfo.name);
    
    return {
      success: true,
      message: `Connected successfully as ${userInfo.name}`,
      userInfo,
    };
  } catch (error) {
    console.error('Connection test failed:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Connection failed',
    };
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { action, searchTerm, clientId, clientSecret, tenantId } = await req.json();
    console.log('CartonCloud function called with action:', action);

    // For test-connection, use provided credentials
    if (action === 'test-connection') {
      if (!clientId || !clientSecret || !tenantId) {
        return new Response(
          JSON.stringify({ error: 'Missing credentials for connection test' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      const result = await testConnection(clientId, clientSecret, tenantId);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // For other actions, fetch credentials from database
    const { data: settings, error: settingsError } = await supabaseClient
      .from('cartoncloud_settings')
      .select('*')
      .eq('is_active', true)
      .maybeSingle();

    if (settingsError) {
      console.error('Error fetching settings:', settingsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch CartonCloud settings' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!settings) {
      return new Response(
        JSON.stringify({ error: 'CartonCloud integration not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const accessToken = await getAccessToken(settings.client_id, settings.client_secret);

    if (action === 'search-orders') {
      if (!searchTerm) {
        return new Response(
          JSON.stringify({ error: 'Search term is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const results = await searchInboundOrders(accessToken, settings.tenant_id, searchTerm);
      
      // Transform results to a simpler format
      const transformedResults = results.map((order: any) => ({
        id: order.id,
        reference: order.references?.customer || order.references?.numericId || 'N/A',
        customer: order.customer?.name || 'Unknown',
        status: order.status || 'Unknown',
        arrivalDate: order.details?.arrivalDate || null,
        itemCount: order.items?.length || 0,
        warehouseName: order.warehouse?.name || 'Default',
      }));

      return new Response(JSON.stringify({ orders: transformedResults }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({ error: 'Unknown action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in cartoncloud function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'An error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
