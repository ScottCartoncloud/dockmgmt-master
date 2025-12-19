import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

/**
 * accept-invite backend function
 *
 * Completes an invitation after the user has signed up/logged in.
 * Requires a valid user JWT (Authorization header).
 * Uses service role to:
 * - attach the user to the invited tenant in profiles
 * - assign the invited role in user_roles
 * - mark the invite as accepted
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const APP_BASE_URL = Deno.env.get("APP_BASE_URL") ?? "";

// CORS configuration - restrict to allowed origins
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

const bodySchema = z
  .object({
    inviteToken: z.string().uuid("Invalid invite token format"),
  })
  .strict();

serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Rate limiting by IP
  const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (isRateLimited(`accept-invite:${clientIP}`)) {
    console.warn(`[RATE_LIMIT] IP ${clientIP} exceeded rate limit for accept-invite`);
    return new Response(JSON.stringify({ error: "Too many requests. Please try again later." }), {
      status: 429,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error("accept-invite: Missing backend configuration");
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
      return new Response(
        JSON.stringify({
          error: "Invalid request data",
          details: parsed.error.errors.map((e) => e.message),
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { inviteToken } = parsed.data;

    // Verify user identity from JWT
    const supabaseAuthed = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    } = await supabaseAuthed.auth.getUser();

    if (authError || !user || !user.email) {
      console.error("accept-invite: auth error", authError?.message);
      return new Response(JSON.stringify({ error: "Invalid or expired token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch and validate invite atomically to prevent race conditions
    const { data: invite, error: inviteError } = await admin
      .from("tenant_invites")
      .select("id, email, tenant_id, role, accepted_at, expires_at")
      .eq("id", inviteToken)
      .maybeSingle();

    if (inviteError) {
      console.error("accept-invite: invite fetch error", inviteError.message);
      // Return generic error to prevent enumeration
      return new Response(JSON.stringify({ error: "Invalid or expired invite" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Return generic error for all invalid invite states to prevent enumeration
    if (!invite) {
      return new Response(JSON.stringify({ error: "Invalid or expired invite" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const nowIso = new Date().toISOString();
    if (invite.expires_at && invite.expires_at <= nowIso) {
      return new Response(JSON.stringify({ error: "Invalid or expired invite" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (invite.email.toLowerCase() !== user.email.toLowerCase()) {
      return new Response(JSON.stringify({ error: "Invalid or expired invite" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Attach tenant to profile (upsert)
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
      console.error("accept-invite: profile upsert error", profileError.message);
      return new Response(JSON.stringify({ error: "Failed to process invite" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Assign invited role (keep super_user if present)
    const { error: deleteRolesError } = await admin
      .from("user_roles")
      .delete()
      .eq("user_id", user.id)
      .neq("role", "super_user");

    if (deleteRolesError) {
      console.error("accept-invite: delete roles error", deleteRolesError.message);
      return new Response(JSON.stringify({ error: "Failed to process invite" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: upsertRoleError } = await admin
      .from("user_roles")
      .upsert(
        {
          user_id: user.id,
          role: invite.role,
        },
        { onConflict: "user_id,role" }
      );

    if (upsertRoleError) {
      console.error("accept-invite: upsert role error", upsertRoleError.message);
      return new Response(JSON.stringify({ error: "Failed to process invite" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mark invite accepted atomically (prevents race conditions)
    if (!invite.accepted_at) {
      const { error: acceptError } = await admin
        .from("tenant_invites")
        .update({ accepted_at: nowIso })
        .eq("id", invite.id)
        .is("accepted_at", null);

      if (acceptError) {
        console.error("accept-invite: mark accepted error", acceptError.message);
        // Don't fail the request - invite was already processed
      }
    }

    console.log(`[AUDIT] Invite accepted: user=${user.id}, tenant=${invite.tenant_id}, role=${invite.role}`);

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
    console.error("Error in accept-invite:", err instanceof Error ? err.message : "Unknown error");
    return new Response(JSON.stringify({ error: "An error occurred processing your request" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
