import { supabase } from '@/integrations/supabase/client';

export interface SMSProvider {
  name: string;
  sendSMS: (to: string, message: string) => Promise<{ success: boolean; error?: string }>;
  sendBulkSMS: (messages: Array<{ to: string; message: string }>) => Promise<{ success: boolean; error?: string }>;
}

// Twilio SMS Provider
class TwilioProvider implements SMSProvider {
  name = 'Twilio';

  async sendSMS(to: string, message: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await supabase.functions.invoke('send-sms-twilio', {
        body: { to, message }
      });

      if (error) throw error;
      return { success: data.success };
    } catch (error) {
      console.error('Twilio SMS error:', error);
      return { success: false, error: error.message };
    }
  }

  async sendBulkSMS(messages: Array<{ to: string; message: string }>): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await supabase.functions.invoke('send-bulk-sms-twilio', {
        body: { messages }
      });

      if (error) throw error;
      return { success: data.success };
    } catch (error) {
      console.error('Twilio bulk SMS error:', error);
      return { success: false, error: error.message };
    }
  }
}

// AfricasTalking SMS Provider (Nigeria-focused)
class AfricasTalkingProvider implements SMSProvider {
  name = 'AfricasTalking';

  async sendSMS(to: string, message: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await supabase.functions.invoke('send-sms-africastalking', {
        body: { to, message }
      });

      if (error) throw error;
      return { success: data.success };
    } catch (error) {
      console.error('AfricasTalking SMS error:', error);
      return { success: false, error: error.message };
    }
  }

  async sendBulkSMS(messages: Array<{ to: string; message: string }>): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await supabase.functions.invoke('send-bulk-sms-africastalking', {
        body: { messages }
      });

      if (error) throw error;
      return { success: data.success };
    } catch (error) {
      console.error('AfricasTalking bulk SMS error:', error);
      return { success: false, error: error.message };
    }
  }
}

export class SMSCommunicationService {
  private static provider: SMSProvider = new TwilioProvider(); // Default provider

  // Set SMS provider (can be switched based on configuration)
  static setProvider(provider: SMSProvider) {
    this.provider = provider;
  }

  // Send single SMS
  static async sendSMS(to: string, message: string): Promise<{ success: boolean; error?: string }> {
    // Log SMS attempt
    await supabase.from('sms_logs').insert({
      to_phone: to,
      message,
      status: 'pending',
      provider: this.provider.name,
    });

    const result = await this.provider.sendSMS(to, message);

    // Update log with result
    await supabase
      .from('sms_logs')
      .update({
        status: result.success ? 'sent' : 'failed',
        error_message: result.error,
        sent_at: result.success ? new Date().toISOString() : null,
      })
      .eq('to_phone', to)
      .eq('message', message)
      .eq('status', 'pending');

    return result;
  }

  // Send bulk SMS
  static async sendBulkSMS(messages: Array<{ to: string; message: string }>): Promise<{ success: boolean; error?: string }> {
    const result = await this.provider.sendBulkSMS(messages);

    // Log each message
    for (const msg of messages) {
      await supabase.from('sms_logs').insert({
        to_phone: msg.to,
        message: msg.message,
        status: result.success ? 'sent' : 'failed',
        provider: this.provider.name,
        sent_at: result.success ? new Date().toISOString() : null,
        error_message: result.error,
      });
    }

    return result;
  }

  // Send report confirmation
  static async sendReportConfirmation(phoneNumber: string, reportId: string, reportType: string): Promise<void> {
    const message = `AMAC: Your ${reportType.replace('_', ' ')} report (ID: ${reportId}) has been received. Thank you for your report.`;
    await this.sendSMS(phoneNumber, message);
  }

  // Send broadcast to all agents
  static async sendBroadcastToAllAgents(message: string, priority: 'normal' | 'urgent' = 'normal'): Promise<void> {
    const { data: agents } = await supabase
      .from('agents')
      .select('phone_number, full_name')
      .eq('verification_status', 'verified')
      .not('phone_number', 'is', null);

    if (!agents?.length) return;

    const prefix = priority === 'urgent' ? 'URGENT - ' : '';
    const fullMessage = `AMAC ${prefix}BROADCAST: ${message}`;

    const messages = agents.map(agent => ({
      to: agent.phone_number!,
      message: fullMessage
    }));

    await this.sendBulkSMS(messages);

    // Log broadcast
    await supabase.from('sms_broadcasts').insert({
      message,
      priority,
      recipients_count: agents.length,
    });
  }

  // Send payment notification
  static async sendPaymentNotification(phoneNumber: string, amount: number, reference: string): Promise<void> {
    const message = `AMAC: Payment of ₦${amount.toLocaleString()} has been sent. Reference: ${reference}. Thank you.`;
    await this.sendSMS(phoneNumber, message);
  }

  // Handle incoming SMS (for two-way communication)
  static async handleIncomingSMS(from: string, message: string): Promise<void> {
    // Log incoming SMS
    await supabase.from('sms_incoming').insert({
      from_phone: from,
      message,
      received_at: new Date().toISOString(),
      processed: false,
    });

    // Process message
    await this.processIncomingMessage(from, message);
  }

  private static async processIncomingMessage(from: string, message: string): Promise<void> {
    const trimmedMessage = message.toLowerCase().trim();

    // Find agent by phone number
    const { data: agent } = await supabase
      .from('agents')
      .select('*')
      .eq('phone_number', from)
      .single();

    if (!agent) {
      await this.sendSMS(from, 'AMAC: Your number is not registered in our system. Please contact your administrator.');
      return;
    }

    // Process command-based messages
    if (trimmedMessage.startsWith('report:')) {
      await this.processSMSReport(agent, trimmedMessage.substring(7).trim());
    } else if (trimmedMessage === 'status') {
      await this.sendStatusInfo(agent);
    } else if (trimmedMessage === 'help') {
      await this.sendHelpInfo(agent);
    } else if (trimmedMessage.startsWith('pin:')) {
      await this.processPINChange(agent, trimmedMessage.substring(4).trim());
    } else {
      await this.sendUnknownCommandInfo(agent);
    }

    // Mark as processed
    await supabase
      .from('sms_incoming')
      .update({ processed: true })
      .eq('from_phone', from)
      .eq('message', message)
      .eq('processed', false);
  }

  private static async processSMSReport(agent: any, reportContent: string): Promise<void> {
    // Create report from SMS
    await supabase.from('reports').insert({
      agent_id: agent.id,
      operator_id: null,
      report_type: 'other',
      details: `[SMS Report] ${reportContent}`,
      ward_number: agent.ward_number,
    });

    await this.sendSMS(
      agent.phone_number,
      'AMAC: Your SMS report has been received and logged. Thank you.'
    );
  }

  private static async sendStatusInfo(agent: any): Promise<void> {
    const message = `AMAC Status: Name: ${agent.full_name}, Ward: ${agent.ward_number}, Verification: ${agent.verification_status}, Payment: ${agent.payment_status}. Last report: ${agent.last_report_at || 'No reports yet'}.`;
    await this.sendSMS(agent.phone_number, message);
  }

  private static async sendHelpInfo(agent: any): Promise<void> {
    const helpMessage = `AMAC Help: Send "report:<your report>" to file a report. Send "status" for your account info. Send "pin:<newpin>" to change your PIN (4 digits).`;
    await this.sendSMS(agent.phone_number, helpMessage);
  }

  private static async sendUnknownCommandInfo(agent: any): Promise<void> {
    await this.sendSMS(agent.phone_number, 'AMAC: Unknown command. Send "help" for available commands.');
  }

  private static async processPINChange(agent: any, newPIN: string): Promise<void> {
    if (!/^\d{4}$/.test(newPIN)) {
      await this.sendSMS(agent.phone_number, 'AMAC: PIN must be exactly 4 digits.');
      return;
    }

    // Update PIN
    await supabase
      .from('agents')
      .update({ pin: newPIN })
      .eq('id', agent.id);

    await this.sendSMS(agent.phone_number, 'AMAC: Your PIN has been successfully updated.');
  }
}

export class WhatsAppService {
  // WhatsApp integration (using Twilio WhatsApp API)
  static async sendWhatsAppMessage(to: string, message: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await supabase.functions.invoke('send-whatsapp', {
        body: { to, message }
      });

      if (error) throw error;
      return { success: data.success };
    } catch (error) {
      console.error('WhatsApp error:', error);
      return { success: false, error: error.message };
    }
  }

  // Send WhatsApp broadcast
  static async sendWhatsAppBroadcast(message: string, agentPhoneNumbers: string[]): Promise<void> {
    for (const phone of agentPhoneNumbers) {
      await this.sendWhatsAppMessage(phone, message);
      // Add small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // Send location request
  static async sendLocationRequest(phoneNumber: string): Promise<void> {
    const message = `AMAC: Please share your current location for verification. Reply with your location coordinates or use the location sharing feature.`;
    await this.sendWhatsAppMessage(phoneNumber, message);
  }
}