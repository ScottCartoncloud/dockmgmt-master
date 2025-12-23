/**
 * cartoncloud-credentials Edge Function
 * 
 * Handles secure storage of CartonCloud API credentials with AES-256-GCM encryption.
 * Credentials are encrypted before storage and only decrypted server-side.
 * 
 * Actions:
 * - save: Encrypt and store credentials
 * - delete: Remove credentials
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const ENCRYPTION_KEY = Deno.env.get('CREDENTIALS_ENCRYPTION_KEY');
const APP_BASE_URL = Deno.env.get("APP_BASE_URL") ?? "";

// CORS configuration - allow all origins for flexibility with preview domains
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 10;
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

// Zod schemas for input validation
const saveCredentialsSchema = z.object({
  action: z.literal('save'),
  client_id: z.string().min(1).max(500),
  client_secret: z.string().min(1).max(500),
  cartoncloud_tenant_id: z.string().min(1).max(100),
}).strict();

const deleteCredentialsSchema = z.object({
  action: z.literal('delete'),
  settings_id: z.string().uuid(),
}).strict();

// Encryption utilities using Web Crypto API
async function getEncryptionKey(): Promise<CryptoKey> {
  if (!ENCRYPTION_KEY) {
    throw new Error('Encryption key not configured');
  }
  
  // Derive a proper AES key from the provided key
  const encoder = new TextEncoder();
  const keyData = encoder.encode(ENCRYPTION_KEY);
  
  // Use PBKDF2 to derive a proper key
  const baseKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );
  
  // Derive AES-GCM key with tenant-scoped salt
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

async function encrypt(plaintext: string): Promise<string> {
  const key = await getEncryptionKey();
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(plaintext)
  );
  
  // Combine IV + ciphertext and encode as base64
  const combined = new Uint8Array(iv.length + new Uint8Array(ciphertext).length);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);
  
  return btoa(String.fromCharCode(...combined));
}

// Audit logging
function logAudit(action: string, userId: string, tenantId: string | null, details: Record<string, any> = {}) {
  console.log('[AUDIT]', JSON.stringify({
    timestamp: new Date().toISOString(),
    action,
    userId,
    tenantId,
    ...details,
  }));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Rate limiting by IP
  const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (isRateLimited(`cartoncloud-credentials:${clientIP}`)) {
    console.warn(`[RATE_LIMIT] IP ${clientIP} exceeded rate limit for cartoncloud-credentials`);
    return new Response(JSON.stringify({ error: "Too many requests. Please try again later." }), {
      status: 429,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Require authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role client for database operations (base table is blocked from regular clients)
    const supabaseServiceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );
    
    // Use user client only for auth
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's tenant and roles
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    const { data: roles } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const userRoles = roles?.map((r: { role: string }) => r.role) || [];
    const isAuthorized = userRoles.includes('admin') || userRoles.includes('super_user');

    if (!isAuthorized) {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userTenantId = profile?.tenant_id;
    const rawBody = await req.json();
    const action = rawBody.action;

    if (action === 'save') {
      const parseResult = saveCredentialsSchema.safeParse(rawBody);
      if (!parseResult.success) {
        return new Response(
          JSON.stringify({ error: 'Invalid request', details: parseResult.error.errors }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { client_id, client_secret, cartoncloud_tenant_id } = parseResult.data;

      if (!userTenantId) {
        return new Response(
          JSON.stringify({ error: 'No tenant assigned to user' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      logAudit('CARTONCLOUD_CREDENTIALS_SAVE', user.id, userTenantId, {
        cartoncloud_tenant_id,
      });

      // Encrypt credentials
      const encryptedClientId = await encrypt(client_id);
      const encryptedClientSecret = await encrypt(client_secret);

      // Check if settings exist for this tenant (use service client to bypass RLS)
      const { data: existing } = await supabaseServiceClient
        .from('cartoncloud_settings')
        .select('id')
        .eq('tenant_id', userTenantId)
        .maybeSingle();

      let result;
      if (existing) {
        const { data, error } = await supabaseServiceClient
          .from('cartoncloud_settings')
          .update({
            client_id: encryptedClientId,
            client_secret: encryptedClientSecret,
            cartoncloud_tenant_id: cartoncloud_tenant_id,
            is_active: true,
          })
          .eq('id', existing.id)
          .select('id, cartoncloud_tenant_id, tenant_id, is_active, created_at, updated_at')
          .single();

        if (error) throw error;
        result = data;
      } else {
        const { data, error } = await supabaseServiceClient
          .from('cartoncloud_settings')
          .insert({
            client_id: encryptedClientId,
            client_secret: encryptedClientSecret,
            cartoncloud_tenant_id: cartoncloud_tenant_id,
            tenant_id: userTenantId,
            is_active: true,
          })
          .select('id, cartoncloud_tenant_id, tenant_id, is_active, created_at, updated_at')
          .single();

        if (error) throw error;
        result = data;
      }

      console.log('Credentials saved (encrypted) for tenant:', userTenantId);

      return new Response(
        JSON.stringify({ success: true, data: result }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'delete') {
      const parseResult = deleteCredentialsSchema.safeParse(rawBody);
      if (!parseResult.success) {
        return new Response(
          JSON.stringify({ error: 'Invalid request', details: parseResult.error.errors }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { settings_id } = parseResult.data;

      logAudit('CARTONCLOUD_CREDENTIALS_DELETE', user.id, userTenantId, {
        settings_id,
      });

      // Use service client to bypass RLS
      const { error } = await supabaseServiceClient
        .from('cartoncloud_settings')
        .delete()
        .eq('id', settings_id);

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Unknown action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in cartoncloud-credentials:', error instanceof Error ? error.message : 'Unknown error');
    return new Response(
      JSON.stringify({ error: 'An error occurred processing your request' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
