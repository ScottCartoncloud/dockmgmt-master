import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

/**
 * accept-invite-by-email backend function
 *
 * Fallback invite acceptance that matches by email address.
 * Used when the token-based flow fails (e.g., localStorage lost during OAuth).
 * Only accepts if there's exactly ONE pending invite for the user's email.
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const APP_BASE_URL = Deno.env.get("APP_BASE_URL") ?? "";

// CORS configuration
const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:8080",
  APP_BASE_URL,
].filter(Boolean);

function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin = origin && ALLOWED_ORIGINS.some(allowed => 
    origin === allowed || origin.endsWith('.lovableproject.com')
  ) ? origin : ALLOWED_ORIGINS[0] || "*";
  
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Credentials": "true",
  };
}

// Rate limiter
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60000;

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  
  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}

const bodySchema = z.object({
  email: z.string().email("Invalid email format"),
}).strict();

serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (isRateLimited(`accept-invite-email:${clientIP}`)) {
    console.warn(`[RATE_LIMIT] IP ${clientIP} exceeded rate limit`);
    return new Response(JSON.stringify({ error: "Too many requests" }), {
      status: 429,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error("accept-invite-by-email: Missing backend configuration");
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const raw = await req.json();
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "Invalid request data" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { email } = parsed.data;

    // Verify user identity from JWT
    const supabaseAuthed = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseAuthed.auth.getUser();

    if (authError || !user || !user.email) {
      console.error("accept-invite-by-email: auth error", authError?.message);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Ensure the email in request matches authenticated user's email
    if (email.toLowerCase() !== user.email.toLowerCase()) {
      console.warn(`accept-invite-by-email: email mismatch - request: ${email}, user: ${user.email}`);
      return new Response(JSON.stringify({ error: "Email mismatch" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Check if user already has a tenant
    const { data: existingProfile } = await admin
      .from("profiles")
      .select("tenant_id")
      .eq("id", user.id)
      .maybeSingle();

    if (existingProfile?.tenant_id) {
      console.log(`accept-invite-by-email: user ${user.id} already has tenant ${existingProfile.tenant_id}`);
      return new Response(JSON.stringify({ success: false, reason: "already_has_tenant" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find pending invites for this email
    const nowIso = new Date().toISOString();
    const { data: invites, error: inviteError } = await admin
      .from("tenant_invites")
      .select("id, email, tenant_id, role, accepted_at, expires_at")
      .eq("email", user.email.toLowerCase())
      .is("accepted_at", null)
      .gt("expires_at", nowIso);

    if (inviteError) {
      console.error("accept-invite-by-email: fetch error", inviteError.message);
      return new Response(JSON.stringify({ error: "Failed to check invites" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!invites || invites.length === 0) {
      console.log(`accept-invite-by-email: no pending invites for ${user.email}`);
      return new Response(JSON.stringify({ success: false, reason: "no_pending_invite" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (invites.length > 1) {
      console.log(`accept-invite-by-email: multiple invites for ${user.email}, cannot auto-accept`);
      return new Response(JSON.stringify({ success: false, reason: "multiple_invites" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const invite = invites[0];
    console.log(`accept-invite-by-email: auto-accepting invite ${invite.id} for ${user.email}`);

    // Attach tenant to profile
    const fullName = (user.user_metadata as any)?.full_name ?? null;
    const { error: profileError } = await admin
      .from("profiles")
      .upsert(
        {
          id: user.id,
          tenant_id: invite.tenant_id,
          email: user.email,
          full_name: fullName,
        },
        { onConflict: "id" }
      );

    if (profileError) {
      console.error("accept-invite-by-email: profile upsert error", profileError.message);
      return new Response(JSON.stringify({ error: "Failed to process invite" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Assign role (keep super_user if present)
    await admin
      .from("user_roles")
      .delete()
      .eq("user_id", user.id)
      .neq("role", "super_user");

    const { error: roleError } = await admin
      .from("user_roles")
      .upsert(
        { user_id: user.id, role: invite.role },
        { onConflict: "user_id,role" }
      );

    if (roleError) {
      console.error("accept-invite-by-email: role upsert error", roleError.message);
      return new Response(JSON.stringify({ error: "Failed to assign role" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mark invite accepted
    await admin
      .from("tenant_invites")
      .update({ accepted_at: nowIso })
      .eq("id", invite.id)
      .is("accepted_at", null);

    console.log(`[AUDIT] Invite auto-accepted by email: user=${user.id}, tenant=${invite.tenant_id}, role=${invite.role}`);

    return new Response(
      JSON.stringify({
        success: true,
        tenantId: invite.tenant_id,
        role: invite.role,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Error in accept-invite-by-email:", err instanceof Error ? err.message : "Unknown");
    return new Response(JSON.stringify({ error: "An error occurred" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
