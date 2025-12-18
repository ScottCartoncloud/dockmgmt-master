import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface InviteEmailRequest {
  email: string;
  inviteToken: string;
  tenantName: string;
  role: string;
  invitedByName?: string;
  appUrl: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, inviteToken, tenantName, role, invitedByName, appUrl }: InviteEmailRequest = await req.json();

    console.log(`Sending invite email to ${email} for tenant ${tenantName}`);

    const signupUrl = `${appUrl}/auth?invite=${inviteToken}`;

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
                  <td style="background-color: #1e3a5f; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: bold;">Dock Management</h1>
                    <p style="color: #a0c4ff; margin: 10px 0 0 0; font-size: 14px;">By CartonCloud</p>
                  </td>
                </tr>
                <!-- Body -->
                <tr>
                  <td style="background-color: #ffffff; padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
                    <h2 style="color: #1e3a5f; margin-top: 0; font-size: 22px;">You're Invited!</h2>
                    
                    <p style="margin: 16px 0;">Hello,</p>
                    
                    <p style="margin: 16px 0;">${invitedByName ? `<strong>${invitedByName}</strong> has invited you` : "You've been invited"} to join <strong>${tenantName}</strong> on Dock Management as a <strong>${role}</strong>.</p>
                    
                    <p style="margin: 16px 0;">Dock Management helps warehouse teams manage cross-docking operations with an intuitive calendar-based scheduling system.</p>
                    
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                      <tr>
                        <td align="center">
                          <a href="${signupUrl}" style="background-color: #1e3a5f; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">Accept Invitation</a>
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
        subject: `You've been invited to join ${tenantName} on Dock Management`,
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
  } catch (error: any) {
    console.error("Error in send-invite-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
