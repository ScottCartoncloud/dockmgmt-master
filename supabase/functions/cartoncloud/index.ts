import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Default API base URL - can be overridden per-tenant
const DEFAULT_CARTONCLOUD_API_BASE = 'https://api.cartoncloud.com';

// Allowed CartonCloud API hostnames for validation
const ALLOWED_API_HOSTS = [
  'api.cartoncloud.com',
  'api.na.cartoncloud.com',
];

const ENCRYPTION_KEY = Deno.env.get('CREDENTIALS_ENCRYPTION_KEY');
const APP_BASE_URL = Deno.env.get("APP_BASE_URL") ?? "";

// Validate and normalize API base URL
function validateApiBaseUrl(url: string | null | undefined, isSuperUser: boolean): string {
  if (!url) return DEFAULT_CARTONCLOUD_API_BASE;
  
  try {
    const parsed = new URL(url);
    
    // Must be HTTPS
    if (parsed.protocol !== 'https:') {
      console.warn('API base URL must use HTTPS, falling back to default');
      return DEFAULT_CARTONCLOUD_API_BASE;
    }
    
    // Check against allowlist
    const isAllowed = ALLOWED_API_HOSTS.includes(parsed.hostname);
    
    // Super users can use custom URLs that match a valid pattern
    if (!isAllowed && !isSuperUser) {
      console.warn('API base URL not in allowlist and user is not super user, falling back to default');
      return DEFAULT_CARTONCLOUD_API_BASE;
    }
    
    // Normalize: return origin only (no path/query)
    return parsed.origin;
  } catch {
    console.warn('Invalid API base URL, falling back to default');
    return DEFAULT_CARTONCLOUD_API_BASE;
  }
}

// CORS configuration - allow all origins for flexibility with preview domains
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  
  entry.count++;
  if (entry.count > RATE_LIMIT_MAX) {
    return true;
  }
  return false;
}

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
  console.log('[AUDIT]', JSON.stringify(logEntry));
}

// Decryption utilities using Web Crypto API
async function getEncryptionKey(): Promise<CryptoKey> {
  if (!ENCRYPTION_KEY) {
    throw new Error('Encryption key not configured');
  }
  
  const encoder = new TextEncoder();
  const keyData = encoder.encode(ENCRYPTION_KEY);
  
  const baseKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );
  
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode('cartoncloud-credentials-v2'),
      iterations: 100000,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function decrypt(ciphertext: string): Promise<string> {
  const key = await getEncryptionKey();
  
  // Decode base64
  const combined = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));
  
  // Extract IV (first 12 bytes) and ciphertext
  const iv = combined.slice(0, 12);
  const encryptedData = combined.slice(12);
  
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    encryptedData
  );
  
  return new TextDecoder().decode(decrypted);
}

// Check if value is encrypted (base64 encoded with specific length characteristics)
function isEncrypted(value: string): boolean {
  if (value.length < 44) return false;
  try {
    atob(value);
    return true;
  } catch {
    return false;
  }
}

async function getAccessToken(
  clientId: string, 
  clientSecret: string, 
  tenantId: string,
  apiBaseUrl: string = DEFAULT_CARTONCLOUD_API_BASE
): Promise<string> {
  // Include apiBaseUrl in cache key to avoid mixing tokens across different API endpoints
  const cacheKey = `${tenantId}:${apiBaseUrl}`;
  if (tokenCache && tokenCache.tenantId === cacheKey && Date.now() < tokenCache.expiresAt - 60000) {
    console.log('Using cached access token');
    return tokenCache.accessToken;
  }

  console.log('Fetching new access token from CartonCloud at:', apiBaseUrl);
  const credentials = btoa(`${clientId}:${clientSecret}`);
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
  
  try {
    const response = await fetch(`${apiBaseUrl}/uaa/oauth/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Accept-Version': '1',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Token fetch failed:', response.status, errorText);
      throw new Error(`Failed to get access token: ${response.status}`);
    }

    const data = await response.json();
    console.log('Access token obtained, expires in:', data.expires_in, 'seconds');
    
    tokenCache = {
      accessToken: data.access_token,
      expiresAt: Date.now() + (data.expires_in * 1000),
      tenantId: cacheKey,
    };

    return data.access_token;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function searchInboundOrders(
  accessToken: string,
  tenantId: string,
  searchTerm: string,
  apiBaseUrl: string = DEFAULT_CARTONCLOUD_API_BASE
): Promise<any[]> {
  console.log('Searching inbound orders for:', searchTerm, 'at:', apiBaseUrl);
  
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

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout
  
  try {
    const response = await fetch(
      `${apiBaseUrl}/tenants/${tenantId}/inbound-orders/search`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept-Version': '1',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(searchPayload),
        signal: controller.signal,
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Search failed:', response.status, errorText);
      throw new Error(`Search failed: ${response.status}`);
    }

    const results = await response.json();
    console.log('Search returned', results.length, 'results');
    return results;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function testConnection(
  clientId: string,
  clientSecret: string,
  tenantId: string,
  apiBaseUrl: string = DEFAULT_CARTONCLOUD_API_BASE
): Promise<{ success: boolean; message: string; userInfo?: any }> {
  try {
    const accessToken = await getAccessToken(clientId, clientSecret, tenantId, apiBaseUrl);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    try {
      const response = await fetch(`${apiBaseUrl}/uaa/userinfo`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept-Version': '1',
        },
        signal: controller.signal,
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
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    console.error('Connection test failed:', error instanceof Error ? error.message : 'Unknown error');
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
): Promise<{ authorized: boolean; error?: string; roles?: string[]; isSuperUser?: boolean }> {
  const { data: roles, error: rolesError } = await supabaseClient
    .from('user_roles')
    .select('role')
    .eq('user_id', userId);

  if (rolesError) {
    console.error('Error fetching user roles:', rolesError.message);
    return { authorized: false, error: 'Failed to verify user permissions' };
  }

  const userRoles = roles?.map((r: { role: string }) => r.role) || [];
  const isSuperUser = userRoles.includes('super_user');
  const isAuthorized = userRoles.includes('admin') || isSuperUser;

  if (!isAuthorized) {
    console.log('User not authorized - roles:', userRoles);
    return {
      authorized: false,
      error: 'Insufficient permissions. Admin or Super User role required.',
      roles: userRoles,
      isSuperUser,
    };
  }

  return { authorized: true, roles: userRoles, isSuperUser };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Rate limiting by IP
  const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (isRateLimited(`cartoncloud:${clientIP}`)) {
    console.warn(`[RATE_LIMIT] IP ${clientIP} exceeded rate limit for cartoncloud`);
    return new Response(JSON.stringify({ error: "Too many requests. Please try again later." }), {
      status: 429,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header provided');
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role client for accessing encrypted credentials (base table is blocked from regular clients)
    const supabaseServiceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    
    if (authError || !user) {
      console.error('Auth error:', authError?.message);
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Authenticated user:', user.id);

    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Error fetching profile:', profileError.message);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch user profile' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userTenantId = profile?.tenant_id;
    console.log('User tenant_id:', userTenantId);

     const authz = await validateUserAuthorization(
       supabaseClient,
       user.id
     );

     if (!authz.authorized) {
       return new Response(
         JSON.stringify({ error: authz.error }),
         { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
     }

     let rawBody: any;
     try {
       rawBody = await req.json();
     } catch {
       return new Response(
         JSON.stringify({ error: 'Invalid request body' }),
         { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
     }

     const { action, searchTerm, clientId, clientSecret, tenantId, appTenantId, apiBaseUrl } = rawBody;
     console.log('CartonCloud function called with action:', action);

     const requestedTenantId = typeof appTenantId === 'string' ? appTenantId : null;
     const effectiveTenantId = requestedTenantId && authz.isSuperUser ? requestedTenantId : userTenantId;

     if (requestedTenantId && !authz.isSuperUser && userTenantId !== requestedTenantId) {
       return new Response(
         JSON.stringify({ error: 'Insufficient permissions for selected tenant' }),
         { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
     }

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

      if (typeof clientId !== 'string' || clientId.length > 500 ||
          typeof clientSecret !== 'string' || clientSecret.length > 500 ||
          typeof tenantId !== 'string' || tenantId.length > 100) {
        return new Response(
          JSON.stringify({ error: 'Invalid credential format' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Validate and use provided API base URL
      const validatedApiBaseUrl = validateApiBaseUrl(apiBaseUrl, !!authz.isSuperUser);
      
      logAudit('CARTONCLOUD_TEST_CONNECTION', user.id, userTenantId, { 
        success: 'pending',
        cartoncloudTenantId: tenantId,
        apiBaseUrl: validatedApiBaseUrl,
      });
      
      const result = await testConnection(clientId, clientSecret, tenantId, validatedApiBaseUrl);
      
      logAudit('CARTONCLOUD_TEST_CONNECTION_RESULT', user.id, userTenantId, { 
        success: result.success,
        cartoncloudTenantId: tenantId,
        apiBaseUrl: validatedApiBaseUrl,
      });
      
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

     // Test saved connection (for existing credentials in database)
     if (action === 'test-saved-connection') {
       if (!effectiveTenantId) {
         return new Response(
           JSON.stringify({ success: false, message: 'No tenant selected' }),
           { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
         );
       }

       // Use service client to access encrypted credentials (base table blocked from regular clients)
       const settingsQuery = supabaseServiceClient
         .from('cartoncloud_settings')
         .select('*')
         .eq('is_active', true)
         .eq('tenant_id', effectiveTenantId);

       const { data: savedSettings, error: savedSettingsError } = await settingsQuery.maybeSingle();

       if (savedSettingsError) {
         console.error('Error fetching settings:', savedSettingsError.message);
         return new Response(
           JSON.stringify({ success: false, message: 'Failed to fetch CartonCloud settings' }),
           { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
         );
       }

       if (!savedSettings) {
         return new Response(
           JSON.stringify({ success: false, message: 'CartonCloud integration not configured' }),
           { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
         );
       }

      let decClientId = savedSettings.client_id;
      let decClientSecret = savedSettings.client_secret;

      if (isEncrypted(savedSettings.client_id)) {
        try {
          decClientId = await decrypt(savedSettings.client_id);
          decClientSecret = await decrypt(savedSettings.client_secret);
        } catch (decryptError) {
          console.error('Failed to decrypt credentials:', decryptError instanceof Error ? decryptError.message : 'Unknown');
          return new Response(
            JSON.stringify({ success: false, message: 'Failed to decrypt credentials. Please re-save your CartonCloud settings.' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Validate API base URL from saved settings
      const validatedApiBaseUrl = validateApiBaseUrl(savedSettings.api_base_url, !!authz.isSuperUser);

      logAudit('CARTONCLOUD_TEST_SAVED_CONNECTION', user.id, userTenantId, { 
        settingsId: savedSettings.id,
        cartoncloudTenantId: savedSettings.cartoncloud_tenant_id,
        apiBaseUrl: validatedApiBaseUrl,
      });

      const result = await testConnection(decClientId, decClientSecret, savedSettings.cartoncloud_tenant_id, validatedApiBaseUrl);
      
      logAudit('CARTONCLOUD_TEST_SAVED_CONNECTION_RESULT', user.id, userTenantId, { 
        success: result.success,
        settingsId: savedSettings.id,
        apiBaseUrl: validatedApiBaseUrl,
      });

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

     // Fetch settings for other actions (use service client to access encrypted credentials)
     if (!effectiveTenantId) {
       return new Response(
         JSON.stringify({ error: 'No tenant selected' }),
         { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
     }

     const settingsQuery = supabaseServiceClient
       .from('cartoncloud_settings')
       .select('*')
       .eq('is_active', true)
       .eq('tenant_id', effectiveTenantId);

     const { data: settings, error: settingsError } = await settingsQuery.maybeSingle();

     if (settingsError) {
       console.error('Error fetching settings:', settingsError.message);
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

    logAudit('CARTONCLOUD_CREDENTIALS_ACCESS', user.id, userTenantId, {
      action,
      settingsId: settings.id,
      cartoncloudTenantId: settings.cartoncloud_tenant_id,
    });

    let decryptedClientId = settings.client_id;
    let decryptedClientSecret = settings.client_secret;

    if (isEncrypted(settings.client_id)) {
      console.log('Decrypting stored credentials');
      try {
        decryptedClientId = await decrypt(settings.client_id);
        decryptedClientSecret = await decrypt(settings.client_secret);
      } catch (decryptError) {
        console.error('Failed to decrypt credentials:', decryptError instanceof Error ? decryptError.message : 'Unknown');
        return new Response(
          JSON.stringify({ error: 'Failed to decrypt credentials. Please re-save your CartonCloud settings.' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Validate API base URL from saved settings
    const validatedApiBaseUrl = validateApiBaseUrl(settings.api_base_url, !!authz.isSuperUser);

    const accessToken = await getAccessToken(
      decryptedClientId, 
      decryptedClientSecret,
      settings.cartoncloud_tenant_id,
      validatedApiBaseUrl
    );

    if (action === 'search-orders') {
      if (!searchTerm) {
        return new Response(
          JSON.stringify({ error: 'Search term is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (typeof searchTerm !== 'string' || searchTerm.length > 200) {
        return new Response(
          JSON.stringify({ error: 'Invalid search term' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const orders = await searchInboundOrders(
        accessToken, 
        settings.cartoncloud_tenant_id, 
        searchTerm,
        validatedApiBaseUrl
      );
      
      const formattedOrders = orders.map((order: any) => ({
        id: order.id,
        reference: order.reference || 'N/A',
        customerName: order.customerName || 'Unknown Customer',
        status: order.status || 'unknown',
        createdAt: order.createdAt,
        expectedDeliveryDate: order.expectedDeliveryDate,
        items: order.items || [],
      }));

      return new Response(JSON.stringify({ orders: formattedOrders }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in cartoncloud function:', error instanceof Error ? error.message : 'Unknown error');
    return new Response(
      JSON.stringify({ error: 'An error occurred processing your request' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
