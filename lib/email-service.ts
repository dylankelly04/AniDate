// Email notification service for AniDate
import { createClient } from "@/lib/supabase/client";

export interface EmailNotification {
  type: 'new_match' | 'new_message' | 'profile_view' | 'ai_reminder' | 'weekly_summary';
  userId: string;
  recipientEmail: string;
  recipientName: string;
  data?: any;
}

export class EmailService {
  private static instance: EmailService;
  private supabase = createClient();

  private constructor() {}

  public static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    return EmailService.instance;
  }

  // Send email notification
  public async sendNotification(notification: EmailNotification): Promise<boolean> {
    try {
      // Check if user has this notification type enabled
      const { data: preferences } = await this.supabase
        .from('user_preferences')
        .select('preference_value')
        .eq('user_id', notification.userId)
        .eq('preference_key', this.getPreferenceKey(notification.type))
        .single();

      // If preference exists and is false, don't send
      if (preferences && preferences.preference_value === 'false') {
        console.log(`Email notification ${notification.type} disabled for user ${notification.userId}`);
        return false;
      }

      // Create email record in database (for tracking)
      const { error } = await this.supabase
        .from('email_notifications')
        .insert({
          user_id: notification.userId,
          type: notification.type,
          recipient_email: notification.recipientEmail,
          recipient_name: notification.recipientName,
          data: notification.data,
          status: 'pending'
        });

      if (error) {
        console.error('Error creating email notification record:', error);
        return false;
      }

      // In a real app, you would integrate with an email service like:
      // - SendGrid
      // - AWS SES
      // - Resend
      // - Nodemailer with SMTP
      
      // For now, we'll just log the email
      console.log(`📧 Email notification sent:`, {
        type: notification.type,
        to: notification.recipientEmail,
        name: notification.recipientName,
        data: notification.data
      });

      return true;
    } catch (error) {
      console.error('Error sending email notification:', error);
      return false;
    }
  }

  // Get preference key for notification type
  private getPreferenceKey(type: string): string {
    const preferenceMap: Record<string, string> = {
      'new_match': 'newMatches',
      'new_message': 'messages',
      'profile_view': 'profileViews',
      'ai_reminder': 'aiPracticeReminders',
      'weekly_summary': 'weeklySummary'
    };
    return preferenceMap[type] || '';
  }

  // Send new match notification
  public async sendNewMatchNotification(
    userId: string, 
    recipientEmail: string, 
    recipientName: string, 
    matchedUserName: string
  ) {
    return this.sendNotification({
      type: 'new_match',
      userId,
      recipientEmail,
      recipientName,
      data: { matchedUserName }
    });
  }

  // Send new message notification
  public async sendNewMessageNotification(
    userId: string, 
    recipientEmail: string, 
    recipientName: string, 
    senderName: string,
    messagePreview: string
  ) {
    return this.sendNotification({
      type: 'new_message',
      userId,
      recipientEmail,
      recipientName,
      data: { senderName, messagePreview }
    });
  }

  // Send profile view notification
  public async sendProfileViewNotification(
    userId: string, 
    recipientEmail: string, 
    recipientName: string, 
    viewerName: string
  ) {
    return this.sendNotification({
      type: 'profile_view',
      userId,
      recipientEmail,
      recipientName,
      data: { viewerName }
    });
  }

  // Send AI practice reminder
  public async sendAIReminderNotification(
    userId: string, 
    recipientEmail: string, 
    recipientName: string
  ) {
    return this.sendNotification({
      type: 'ai_reminder',
      userId,
      recipientEmail,
      recipientName
    });
  }

  // Send weekly summary
  public async sendWeeklySummaryNotification(
    userId: string, 
    recipientEmail: string, 
    recipientName: string,
    summaryData: any
  ) {
    return this.sendNotification({
      type: 'weekly_summary',
      userId,
      recipientEmail,
      recipientName,
      data: summaryData
    });
  }
}

// Export singleton instance
export const emailService = EmailService.getInstance();
