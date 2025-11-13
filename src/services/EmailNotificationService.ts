/**
 * Email Notification Service
 * Handles sending email notifications for transfers, invites, and reminders
 * 
 * TODO: Integrate with your chosen email provider:
 * - SendGrid: https://sendgrid.com/
 * - Resend: https://resend.com/
 * - AWS SES: https://aws.amazon.com/ses/
 */

import { PendingTransfer } from "../types/database";
import Constants from "expo-constants";

export type EmailTemplate = "invite" | "transfer_notification" | "transfer_confirmation" | "expiring_reminder" | "claimed_notification";

export type EmailParams = {
  to: string;
  template: EmailTemplate;
  data: Record<string, any>;
};

type ExpoExtra = {
  appUrl?: string;
  supportEmail?: string;
  sendgridApiKey?: string;
  resendApiKey?: string;
  awsSesRegion?: string;
  awsSesAccessKey?: string;
  awsSesSecretKey?: string;
};

class EmailNotificationService {
  private readonly extra = (Constants?.expoConfig?.extra ?? {}) as ExpoExtra;
  private readonly APP_URL = this.extra.appUrl ?? "https://app.metasend.io";
  private readonly SUPPORT_EMAIL = this.extra.supportEmail ?? "support@metasend.io";
  private readonly SENDGRID_API_KEY = this.extra.sendgridApiKey ?? "";
  private readonly RESEND_API_KEY = this.extra.resendApiKey ?? "";
  private readonly AWS_SES_REGION = this.extra.awsSesRegion ?? "";
  private readonly AWS_SES_ACCESS_KEY = this.extra.awsSesAccessKey ?? "";
  private readonly AWS_SES_SECRET_KEY = this.extra.awsSesSecretKey ?? "";

  /**
   * Send invite email to non-registered user with pending transfer
   */
  async sendInviteWithPendingTransfer(
    recipientEmail: string,
    senderName: string,
    amount: string,
    token: string,
    transferId: string
  ): Promise<boolean> {
    const subject = `You received ${amount} ${token} from ${senderName}!`;
    
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #1E293B; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #3A80F7 0%, #10B981 100%); color: white; padding: 40px 20px; text-align: center; border-radius: 12px; }
            .amount { font-size: 48px; font-weight: bold; margin: 20px 0; }
            .content { background: #F8FAFC; padding: 30px; border-radius: 12px; margin: 20px 0; }
            .button { display: inline-block; background: #3A80F7; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
            .info-box { background: white; border-left: 4px solid #3A80F7; padding: 16px; margin: 20px 0; border-radius: 4px; }
            .footer { text-align: center; color: #64748B; font-size: 14px; margin-top: 40px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>You've Got Money!</h1>
              <div class="amount">${amount} ${token}</div>
              <p>from ${senderName}</p>
            </div>

            <div class="content">
              <h2>Hi there! 👋</h2>
              <p>${senderName} (${recipientEmail}) sent you <strong>${amount} ${token}</strong> using MetaSend.</p>
              
              <p>Create your free MetaSend wallet to claim your funds:</p>
              
              <a href="${this.APP_URL}/claim/${transferId}" class="button">
                Claim Your ${token}
              </a>

              <div class="info-box">
                <strong>⏰ Your funds are held securely for 7 days.</strong>
                <p>After 7 days, unclaimed funds will be returned to the sender.</p>
              </div>

              <h3>What's MetaSend?</h3>
              <p>MetaSend is a multi-chain crypto wallet that makes sending money as easy as email. No complex addresses, just send money using email addresses!</p>
              
              <ul>
                <li>✅ Send to any email address</li>
                <li>✅ Support for multiple blockchains</li>
                <li>✅ Gasless transfers with Coinbase Paymaster</li>
                <li>✅ Secure Coinbase Smart Wallet</li>
              </ul>
            </div>

            <div class="footer">
              <p>Questions? Contact us at <a href="mailto:${this.SUPPORT_EMAIL}">${this.SUPPORT_EMAIL}</a></p>
              <p>© ${new Date().getFullYear()} MetaSend. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: recipientEmail,
      subject,
      html,
    });
  }

  /**
   * Send notification to existing user about received transfer
   */
  async sendTransferNotification(
    recipientEmail: string,
    recipientName: string,
    senderName: string,
    amount: string,
    token: string,
    chain: string
  ): Promise<boolean> {
    const subject = `You received ${amount} ${token} from ${senderName}`;

    const html = `
      <!DOCTYPE html>
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #1E293B;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #3A80F7 0%, #10B981 100%); color: white; padding: 30px; border-radius: 12px; text-align: center;">
              <h2>💸 Transfer Received</h2>
              <p style="font-size: 32px; font-weight: bold; margin: 20px 0;">${amount} ${token}</p>
              <p>from ${senderName}</p>
            </div>

            <div style="padding: 30px 0;">
              <p>Hi ${recipientName}!</p>
              <p>${senderName} just sent you <strong>${amount} ${token}</strong> on the ${chain} network.</p>
              
              <a href="${this.APP_URL}/wallet" style="display: inline-block; background: #3A80F7; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; margin: 20px 0;">
                View in App
              </a>

              <p style="color: #64748B; font-size: 14px;">The funds are now in your MetaSend wallet and ready to use.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: recipientEmail,
      subject,
      html,
    });
  }

  /**
   * Send confirmation to sender after successful transfer
   */
  async sendTransferConfirmation(
    senderEmail: string,
    senderName: string,
    recipientEmail: string,
    amount: string,
    token: string,
    status: "sent" | "pending"
  ): Promise<boolean> {
    const subject = status === "sent" 
      ? `✅ Transfer sent to ${recipientEmail}`
      : `⏳ Transfer pending for ${recipientEmail}`;

    const statusMessage = status === "sent"
      ? `Your transfer of <strong>${amount} ${token}</strong> to ${recipientEmail} was successful!`
      : `Your transfer of <strong>${amount} ${token}</strong> to ${recipientEmail} is pending. They'll receive an email invitation to claim the funds.`;

    const html = `
      <!DOCTYPE html>
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #1E293B;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2>${status === "sent" ? "✅" : "⏳"} Transfer Confirmation</h2>
            <p>Hi ${senderName}!</p>
            <p>${statusMessage}</p>
            
            <div style="background: #F8FAFC; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>Amount:</strong> ${amount} ${token}</p>
              <p style="margin: 5px 0;"><strong>Recipient:</strong> ${recipientEmail}</p>
              <p style="margin: 5px 0;"><strong>Status:</strong> ${status === "sent" ? "Delivered" : "Pending Claim"}</p>
            </div>

            ${status === "pending" ? `
              <p style="color: #64748B; font-size: 14px;">
                The recipient has 7 days to claim the funds. If unclaimed, the transfer will be automatically refunded to your wallet.
              </p>
            ` : ""}

            <a href="${this.APP_URL}/activity" style="display: inline-block; background: #3A80F7; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin: 20px 0;">
              View Transaction History
            </a>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: senderEmail,
      subject,
      html,
    });
  }

  /**
   * Send reminder about expiring pending transfer
   */
  async sendPendingTransferExpiring(
    recipientEmail: string,
    senderName: string,
    amount: string,
    token: string,
    hoursLeft: number,
    transferId: string
  ): Promise<boolean> {
    const daysLeft = Math.ceil(hoursLeft / 24);
    const subject = `⏰ Reminder: Claim your ${amount} ${token} (${daysLeft} day${daysLeft !== 1 ? 's' : ''} left)`;

    const html = `
      <!DOCTYPE html>
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #1E293B;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 20px; border-radius: 8px;">
              <h2 style="color: #92400E; margin-top: 0;">⏰ Time Running Out!</h2>
              <p style="color: #78350F;">Your pending transfer will expire in <strong>${daysLeft} day${daysLeft !== 1 ? 's' : ''}</strong>.</p>
            </div>

            <div style="padding: 20px 0;">
              <p>Hi there!</p>
              <p>${senderName} sent you <strong>${amount} ${token}</strong> on MetaSend ${7 - daysLeft} days ago.</p>
              <p><strong>You have ${daysLeft} day${daysLeft !== 1 ? 's' : ''} left to claim it!</strong></p>

              <a href="${this.APP_URL}/claim/${transferId}" style="display: inline-block; background: #F59E0B; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0;">
                Claim Your ${token} Now
              </a>

              <p style="background: #FEE2E2; border-left: 4px solid #DC2626; padding: 16px; border-radius: 4px; color: #991B1B;">
                <strong>Important:</strong> After 7 days, unclaimed funds will be automatically returned to the sender.
              </p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: recipientEmail,
      subject,
      html,
    });
  }

  /**
   * Notify sender when their pending transfer is claimed
   */
  async sendPendingTransferClaimed(
    senderEmail: string,
    senderName: string,
    recipientEmail: string,
    amount: string,
    token: string
  ): Promise<boolean> {
    const subject = `✅ ${recipientEmail} claimed your ${amount} ${token}`;

    const html = `
      <!DOCTYPE html>
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #1E293B;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #D1FAE5; border-left: 4px solid #10B981; padding: 20px; border-radius: 8px;">
              <h2 style="color: #065F46; margin-top: 0;">✅ Transfer Claimed!</h2>
            </div>

            <div style="padding: 20px 0;">
              <p>Hi ${senderName}!</p>
              <p>Great news! ${recipientEmail} has claimed your transfer of <strong>${amount} ${token}</strong>.</p>
              <p>The funds have been successfully delivered to their MetaSend wallet.</p>

              <a href="${this.APP_URL}/activity" style="display: inline-block; background: #10B981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin: 20px 0;">
                View Transaction
              </a>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: senderEmail,
      subject,
      html,
    });
  }

  /**
   * Notify sender when pending transfer expires and funds are returned
   */
  async sendPendingTransferExpired(
    senderEmail: string,
    senderName: string,
    recipientEmail: string,
    amount: string,
    token: string
  ): Promise<boolean> {
    const subject = `Unclaimed transfer returned: ${amount} ${token}`;

    const html = `
      <!DOCTYPE html>
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #1E293B;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2>🔄 Transfer Expired - Funds Returned</h2>
            <p>Hi ${senderName}!</p>
            <p>Your transfer of <strong>${amount} ${token}</strong> to ${recipientEmail} was not claimed within 7 days.</p>
            <p>The funds have been automatically returned to your MetaSend wallet.</p>

            <div style="background: #F8FAFC; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>Amount Returned:</strong> ${amount} ${token}</p>
              <p style="margin: 5px 0;"><strong>Original Recipient:</strong> ${recipientEmail}</p>
            </div>

            <p style="color: #64748B; font-size: 14px;">
              You can try sending again or contact ${recipientEmail} directly to let them know.
            </p>

            <a href="${this.APP_URL}/wallet" style="display: inline-block; background: #3A80F7; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin: 20px 0;">
              View Your Wallet
            </a>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: senderEmail,
      subject,
      html,
    });
  }

  /**
   * Send email using configured provider
   */
  private async sendEmail(params: { to: string; subject: string; html: string }): Promise<boolean> {
    // Use Resend if configured
    if (this.RESEND_API_KEY) {
      try {
        const { Resend } = await import("resend");
        const resend = new Resend(this.RESEND_API_KEY);
        
        await resend.emails.send({
          from: this.SUPPORT_EMAIL,
          to: params.to,
          subject: params.subject,
          html: params.html,
        });

        console.log("✅ Email sent via Resend:", {
          to: params.to,
          subject: params.subject,
        });

        return true;
      } catch (error) {
        console.error("Resend email error:", error);
        throw new Error(`Failed to send email: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }

    // Use SendGrid if configured (requires @sendgrid/mail package)
    if (this.SENDGRID_API_KEY) {
      console.warn("⚠️  SendGrid configured but @sendgrid/mail not installed. Run: npm install @sendgrid/mail");
      console.log("📧 Email (SendGrid mock):", {
        to: params.to,
        subject: params.subject,
      });
      return true;
    }

    // No email service configured - log warning
    console.warn("⚠️  No email service configured. Set RESEND_API_KEY or SENDGRID_API_KEY in .env");
    console.log("📧 Email (mock):", {
      to: params.to,
      subject: params.subject,
      sendgridConfigured: !!this.SENDGRID_API_KEY,
      resendConfigured: !!this.RESEND_API_KEY,
    });

    return true;
  }
}

// Export singleton instance
export const emailNotificationService = new EmailNotificationService();
