import { Header } from '@/components/Header';
import cartonCloudLogo from '@/assets/cartoncloud-logo.png';

const EmailPreview = () => {
  // Sample data for preview
  const sampleData = {
    invitedByName: 'John Smith',
    tenantName: 'Acme Logistics',
    role: 'Operator',
    signupUrl: 'https://your-app.lovable.app/auth?invite=sample-token-123',
  };

  // CartonCloud blue matching the app header: HSL(206, 95%, 36%) = #0580c7
  const brandBlue = '#0580c7';

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
                  <img src="https://www.cartoncloud.com/wp-content/uploads/2021/03/cartoncloud-logo-white.png" alt="CartonCloud" style="height: 40px; margin-bottom: 12px;" />
                  <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: bold;">Dock Management</h1>
                </td>
              </tr>
              <!-- Body -->
              <tr>
                <td style="background-color: #ffffff; padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
                  <h2 style="color: ${brandBlue}; margin-top: 0; font-size: 22px;">You're Invited!</h2>
                  
                  <p style="margin: 16px 0;">Hello,</p>
                  
                  <p style="margin: 16px 0;"><strong>${sampleData.invitedByName}</strong> has invited you to join <strong>${sampleData.tenantName}</strong> on Dock Management as a <strong>${sampleData.role}</strong>.</p>
                  
                  <p style="margin: 16px 0;">Dock Management helps warehouse teams manage cross-docking operations with an intuitive calendar-based scheduling system.</p>
                  
                  <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                    <tr>
                      <td align="center">
                        <a href="${sampleData.signupUrl}" style="background-color: ${brandBlue}; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">Accept Invitation</a>
                      </td>
                    </tr>
                  </table>
                  
                  <p style="color: #666666; font-size: 14px; margin: 16px 0;">Or copy and paste this link into your browser:</p>
                  <p style="background-color: #f7fafc; padding: 12px; border-radius: 4px; word-break: break-all; font-size: 13px; color: #4a5568; margin: 16px 0;">${sampleData.signupUrl}</p>
                  
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

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      
      <div className="flex-1 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-foreground">Email Preview</h1>
            <p className="text-muted-foreground">Preview of the invite email template with sample data.</p>
          </div>

          <div className="bg-muted p-4 rounded-lg mb-4">
            <p className="text-sm font-medium">Subject: You've been invited to join {sampleData.tenantName} on Dock Management</p>
          </div>

          <div className="border rounded-lg overflow-hidden shadow-lg">
            <iframe
              srcDoc={emailHtml}
              title="Email Preview"
              className="w-full h-[700px] bg-white"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailPreview;
