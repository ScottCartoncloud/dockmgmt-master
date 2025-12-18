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

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const bodySchema = z
  .object({
    inviteToken: z.string().uuid("Invalid invite token format"),
  })
  .strict();

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
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
      console.error("accept-invite: auth error", authError);
      return new Response(JSON.stringify({ error: "Invalid or expired token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch the invite (by ID)
    const { data: invite, error: inviteError } = await admin
      .from("tenant_invites")
      .select("id, email, tenant_id, role, accepted_at, expires_at")
      .eq("id", inviteToken)
      .maybeSingle();

    if (inviteError) {
      console.error("accept-invite: invite fetch error", inviteError);
      return new Response(JSON.stringify({ error: "Failed to fetch invite" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!invite) {
      return new Response(JSON.stringify({ error: "Invite not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const nowIso = new Date().toISOString();
    if (invite.expires_at && invite.expires_at <= nowIso) {
      return new Response(JSON.stringify({ error: "Invite expired" }), {
        status: 410,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (invite.email.toLowerCase() !== user.email.toLowerCase()) {
      return new Response(JSON.stringify({ error: "Invite email mismatch" }), {
        status: 403,
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
      console.error("accept-invite: profile upsert error", profileError);
      return new Response(JSON.stringify({ error: "Failed to attach profile" }), {
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
      console.error("accept-invite: delete roles error", deleteRolesError);
      return new Response(JSON.stringify({ error: "Failed to update roles" }), {
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
      console.error("accept-invite: upsert role error", upsertRoleError);
      return new Response(JSON.stringify({ error: "Failed to assign role" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mark invite accepted (idempotent)
    if (!invite.accepted_at) {
      const { error: acceptError } = await admin
        .from("tenant_invites")
        .update({ accepted_at: nowIso })
        .eq("id", invite.id)
        .is("accepted_at", null);

      if (acceptError) {
        console.error("accept-invite: mark accepted error", acceptError);
        return new Response(JSON.stringify({ error: "Failed to accept invite" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

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
  } catch (err: any) {
    console.error("Error in accept-invite:", err);
    return new Response(JSON.stringify({ error: err?.message ?? "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
