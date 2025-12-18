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
  tenantId: string;
}

let tokenCache: TokenCache | null = null;

// Audit logging for security-sensitive operations
function logAudit(action: string, userId: string, tenantId: string | null, details: Record<string, any> = {}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    action,
    userId,
    tenantId,
    ...details,
  };
  // Log to console (captured by Supabase logs)
  console.log('[AUDIT]', JSON.stringify(logEntry));
}

async function getAccessToken(clientId: string, clientSecret: string, tenantId: string): Promise<string> {
  // Check if we have a valid cached token for the same tenant
  if (tokenCache && tokenCache.tenantId === tenantId && Date.now() < tokenCache.expiresAt - 60000) {
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
    tenantId,
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
    const accessToken = await getAccessToken(clientId, clientSecret, tenantId);
    
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

// Helper to validate user authorization
async function validateUserAuthorization(
  supabaseClient: any, 
  userId: string, 
  userTenantId: string | null
): Promise<{ authorized: boolean; error?: string }> {
  // Check if user has admin or super_user role
  const { data: roles, error: rolesError } = await supabaseClient
    .from('user_roles')
    .select('role')
    .eq('user_id', userId);

  if (rolesError) {
    console.error('Error fetching user roles:', rolesError);
    return { authorized: false, error: 'Failed to verify user permissions' };
  }

  const userRoles = roles?.map((r: { role: string }) => r.role) || [];
  const isAuthorized = userRoles.includes('admin') || userRoles.includes('super_user');

  if (!isAuthorized) {
    console.log('User not authorized - roles:', userRoles);
    return { authorized: false, error: 'Insufficient permissions. Admin or Super User role required.' };
  }

  return { authorized: true };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Extract and validate JWT from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header provided');
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create client with user's auth context to leverage RLS
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify the user's JWT and get user info
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Authenticated user:', user.id);

    // Get user's tenant_id from profile
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Error fetching profile:', profileError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch user profile' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userTenantId = profile?.tenant_id;
    console.log('User tenant_id:', userTenantId);

    // Validate user has admin or super_user role
    const { authorized, error: authzError } = await validateUserAuthorization(
      supabaseClient, 
      user.id, 
      userTenantId
    );

    if (!authorized) {
      return new Response(
        JSON.stringify({ error: authzError }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action, searchTerm, clientId, clientSecret, tenantId } = await req.json();
    console.log('CartonCloud function called with action:', action);

    // Input validation
    if (action && typeof action !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Invalid action parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // For test-connection, use provided credentials (admin testing new credentials)
    if (action === 'test-connection') {
      if (!clientId || !clientSecret || !tenantId) {
        return new Response(
          JSON.stringify({ error: 'Missing credentials for connection test' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Validate credential formats
      if (typeof clientId !== 'string' || clientId.length > 500 ||
          typeof clientSecret !== 'string' || clientSecret.length > 500 ||
          typeof tenantId !== 'string' || tenantId.length > 100) {
        return new Response(
          JSON.stringify({ error: 'Invalid credential format' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      logAudit('CARTONCLOUD_TEST_CONNECTION', user.id, userTenantId, { 
        success: 'pending',
        cartoncloudTenantId: tenantId 
      });
      
      const result = await testConnection(clientId, clientSecret, tenantId);
      
      logAudit('CARTONCLOUD_TEST_CONNECTION_RESULT', user.id, userTenantId, { 
        success: result.success,
        cartoncloudTenantId: tenantId 
      });
      
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // For other actions, fetch credentials from database using RLS
    // RLS will ensure user can only access their tenant's settings
    let settingsQuery = supabaseClient
      .from('cartoncloud_settings')
      .select('*')
      .eq('is_active', true);

    // Filter by user's tenant if they have one (super_users can see all via RLS)
    if (userTenantId) {
      settingsQuery = settingsQuery.eq('tenant_id', userTenantId);
    }

    const { data: settings, error: settingsError } = await settingsQuery.maybeSingle();

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

    // Audit log: credentials being accessed server-side
    logAudit('CARTONCLOUD_CREDENTIALS_ACCESS', user.id, userTenantId, {
      action,
      settingsId: settings.id,
      cartoncloudTenantId: settings.cartoncloud_tenant_id,
    });

    const accessToken = await getAccessToken(
      settings.client_id, 
      settings.client_secret,
      settings.cartoncloud_tenant_id
    );

    if (action === 'search-orders') {
      if (!searchTerm) {
        return new Response(
          JSON.stringify({ error: 'Search term is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Validate searchTerm
      if (typeof searchTerm !== 'string' || searchTerm.length > 200) {
        return new Response(
          JSON.stringify({ error: 'Invalid search term' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const results = await searchInboundOrders(accessToken, settings.cartoncloud_tenant_id, searchTerm);
      
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
