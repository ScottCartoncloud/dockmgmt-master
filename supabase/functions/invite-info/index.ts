import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
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
    origin === allowed || origin.endsWith('.lovableproject.com') || origin.endsWith('.lovable.app')
  ) ? origin : ALLOWED_ORIGINS[0] || "*";
  
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Credentials": "true",
  };
}

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 20;
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

const schema = z
  .object({
    inviteToken: z.string().uuid("Invalid invite token format"),
  })
  .strict();

type InviteInfoResponse = {
  email: string;
  tenantName: string;
  role: string;
};

serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Rate limiting by IP
  const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (isRateLimited(`invite-info:${clientIP}`)) {
    console.warn(`[RATE_LIMIT] IP ${clientIP} exceeded rate limit for invite-info`);
    return new Response(JSON.stringify({ error: "Too many requests. Please try again later." }), {
      status: 429,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error("Missing backend configuration for invite-info");
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const raw = await req.json();
    const parsed = schema.safeParse(raw);
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

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data, error } = await admin
      .from("tenant_invites")
      .select("id, email, role, expires_at, accepted_at, tenants(name)")
      .eq("id", inviteToken)
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (error) {
      console.error("Error fetching invite:", error.message);
      // Return generic error to prevent enumeration
      return new Response(JSON.stringify({ error: "Invalid or expired invite" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!data) {
      // Return generic error to prevent enumeration
      return new Response(JSON.stringify({ error: "Invalid or expired invite" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response: InviteInfoResponse = {
      email: data.email,
      tenantName: (data.tenants as any)?.name ?? "Unknown",
      role: String((data as any).role ?? "viewer"),
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error in invite-info:", err instanceof Error ? err.message : "Unknown error");
    return new Response(JSON.stringify({ error: "An error occurred processing your request" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
