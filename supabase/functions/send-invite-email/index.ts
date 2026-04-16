/**
 * send-invite-email Edge Function
 * 
 * SECURITY: Redirect URLs are server-controlled via APP_BASE_URL environment variable.
 * This prevents open redirect attacks where malicious actors could craft invite emails
 * pointing to phishing sites. Zod schemas are mandatory for all edge function input validation.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const APP_BASE_URL = Deno.env.get("APP_BASE_URL");

// CORS headers (web-safe defaults)
// NOTE: We do not use cookies/credentials for these requests, so "*" is safe here.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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

// Zod schema for strict input validation - rejects unknown fields
const inviteEmailSchema = z.object({
  email: z.string().email("Invalid email format").max(255, "Email too long"),
  inviteToken: z.string().uuid("Invalid invite token format"),
  tenantId: z.string().uuid("Invalid tenant ID format"),
  role: z.enum(["admin", "operator", "viewer", "Admin", "Operator", "Viewer"], {
    errorMap: () => ({ message: "Invalid role" }),
  }),
  invitedByName: z.string().max(200, "Name too long").optional(),
}).strict(); // Reject any additional fields

// HTML escape function to prevent XSS in email templates
function escapeHtml(str: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  };
  return str.replace(/[&<>"']/g, m => map[m]);
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Rate limiting by IP
  const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (isRateLimited(`send-invite-email:${clientIP}`)) {
    console.warn(`[RATE_LIMIT] IP ${clientIP} exceeded rate limit for send-invite-email`);
    return new Response(JSON.stringify({ error: "Too many requests. Please try again later." }), {
      status: 429,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Validate APP_BASE_URL is configured, trim whitespace and trailing slashes
    const baseUrl = APP_BASE_URL?.trim().replace(/\/+$/, '');
    if (!baseUrl) {
      console.error("APP_BASE_URL environment variable not configured");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Require authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header provided');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with user's auth context
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify JWT and get user
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    
    if (authError || !user) {
      console.error('Auth error:', authError?.message);
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log('Authenticated user:', user.id);

    // Parse and validate request body with Zod
    const rawBody = await req.json();
    const parseResult = inviteEmailSchema.safeParse(rawBody);
    
    if (!parseResult.success) {
      console.error('Validation error:', parseResult.error.errors);
      return new Response(
        JSON.stringify({ 
          error: 'Invalid request data',
          details: parseResult.error.errors.map(e => e.message)
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { email, inviteToken, tenantId, role, invitedByName } = parseResult.data;

    // Get user's roles for authorization
    const { data: roles } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const userRoles = roles?.map((r: { role: string }) => r.role) || [];
    const isAuthorized = userRoles.includes('admin') || userRoles.includes('super_user');

    if (!isAuthorized) {
      console.log('User not authorized - roles:', userRoles);
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions. Admin or Super User role required.' }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user can invite for this tenant via user_tenants (not profile.tenant_id)
    if (!userRoles.includes('super_user')) {
      const serviceClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      const { data: enrollment } = await serviceClient
        .from('user_tenants')
        .select('id')
        .eq('user_id', user.id)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (!enrollment) {
        console.log('User not enrolled in tenant:', tenantId);
        return new Response(
          JSON.stringify({ error: 'Cannot send invites for other tenants' }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Fetch tenant name from database
    const { data: tenant, error: tenantError } = await supabaseClient
      .from('tenants')
      .select('name')
      .eq('id', tenantId)
      .single();

    if (tenantError || !tenant) {
      console.error('Tenant not found:', tenantId);
      return new Response(
        JSON.stringify({ error: 'Tenant not found' }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[AUDIT] Sending invite email to ${email} for tenant ${tenant.name} by user ${user.id}`);

    // Construct signup URL server-side using trusted APP_BASE_URL (trimmed)
    const signupUrl = `${baseUrl}/auth#invite=${inviteToken}`;
    
    // CartonCloud logo - hosted from our own public folder for reliable email rendering
    const logoUrl = `${baseUrl}/images/cartoncloud-logo-white.png`;
    
    // CartonCloud brand blue matching the app header: HSL(206, 95%, 36%)
    const brandBlue = '#0580c7';

    // Sanitize all user-provided values for HTML template
    const safeTenantName = escapeHtml(tenant.name);
    const safeRole = escapeHtml(role);
    const safeInvitedByName = invitedByName ? escapeHtml(invitedByName) : null;

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px;">
                <!-- Header -->
                <tr>
                  <td style="background-color: ${brandBlue}; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
                    <img src="${logoUrl}" alt="CartonCloud" style="height: 40px; margin-bottom: 12px;" />
                    <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: bold;">Dock Management</h1>
                  </td>
                </tr>
                <!-- Body -->
                <tr>
                  <td style="background-color: #ffffff; padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
                    <h2 style="color: ${brandBlue}; margin-top: 0; font-size: 22px;">You're Invited!</h2>
                    
                    <p style="margin: 16px 0;">Hello,</p>
                    
                    <p style="margin: 16px 0;">${safeInvitedByName ? `<strong>${safeInvitedByName}</strong> has invited you` : "You've been invited"} to join <strong>${safeTenantName}</strong> on Dock Management as a <strong>${safeRole}</strong>.</p>
                    
                    <p style="margin: 16px 0;">Dock Management helps warehouse teams manage cross-docking operations with an intuitive calendar-based scheduling system.</p>
                    
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                      <tr>
                        <td align="center">
                          <a href="${signupUrl}" style="background-color: ${brandBlue}; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">Accept Invitation</a>
                        </td>
                      </tr>
                    </table>
                    
                    <p style="color: #666666; font-size: 14px; margin: 16px 0;">Or copy and paste this link into your browser:</p>
                    <p style="background-color: #f7fafc; padding: 12px; border-radius: 4px; word-break: break-all; font-size: 13px; color: #4a5568; margin: 16px 0;">${signupUrl}</p>
                    
                    <p style="color: #666666; font-size: 14px; margin-top: 30px;">This invitation will expire in 7 days.</p>
                    
                    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
                    
                    <p style="color: #999999; font-size: 12px; text-align: center; margin: 0;">
                      If you didn't expect this invitation, you can safely ignore this email.
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

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Dock Management <noreply@dockmgmt.cartoncloud.com>",
        to: [email],
        subject: `You've been invited to join ${safeTenantName} on Dock Management`,
        html: emailHtml,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Resend API error:", data);
      throw new Error(data.message || "Failed to send email");
    }

    console.log("Invite email sent successfully:", data);

    return new Response(JSON.stringify({ success: true, ...data }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error) {
    console.error("Error in send-invite-email function:", error instanceof Error ? error.message : "Unknown error");
    return new Response(
      JSON.stringify({ error: "An error occurred processing your request" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
