import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

export interface WhatsAppGroup {
  id: string;
  group_name: string;
  description?: string;
  phone_numbers: string[];
  broadcast_enabled: boolean;
  auto_reply_enabled: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface WhatsAppMessage {
  id: string;
  group_id?: string;
  sender_id: string;
  agent_id?: string;
  message_content: string;
  message_type: 'text' | 'image' | 'document' | 'location' | 'payment_update' | 'emergency_alert';
  message_content_type?: string;
  media_url?: string;
  thumbnail_url?: string;
  location_lat?: number;
  location_lng?: number;
  whatsapp_message_id?: string;
  status: 'pending' | 'sent' | 'delivered' | 'message_date_failed' | 'cancelled';
  error_message?: string;
  sent_at?: string;
  delivered_at?: string;
  read_at?: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  agent?: {
    full_name: string;
    phone_number?: string;
    ward_name?: string;
    ward_number?: string;
  };
  group?: {
    name: string;
  };
}

export interface WhatsAppTemplate {
  id: string;
  template_name: string;
  category: 'broadcast' | 'payment_reminder' | 'emergency_alert' | 'verification_request' | 'welcome';
  message_content: string;
  variables?: Record<string, any>;
  auto_send: boolean;
  conditions?: Record<string, any>;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface WhatsAppAnalytics {
  date: string;
  total_sent: number;
  delivered: number;
  failed: number;
  read_rate: number;
  response_time_avg: number;
  group_stats: Record<string, any>;
}

export class WhatsAppService {
  // Create WhatsApp group
  static async createGroup(groupData: {
    group_name: string;
    description?: string;
    phone_numbers?: string[];
  }): Promise<{ data?: WhatsAppGroup; error?: any }> {
    try {
      const { data, error } = await supabase
        .from('whatsapp_groups')
        .insert({
          group_name: groupData.group_name,
          description: groupData.description,
          phone_numbers: groupData.phone_numbers || [],
        broadcast_enabled: groupData.broadcast_enabled || true,
          auto_reply_enabled: groupData.auto_reply_enabled || true,
        })
        .select('*')
        .single();

      if (error) throw error;

      return { data: data as WhatsAppGroup };
    } catch (error) {
      return { error };
    }
  }

  // Add agent to WhatsApp group
  static async addAgentToGroup(
    agentId: string,
    groupId: string
  ): Promise<{ error?: any }> {
    try {
      // Call database function to handle business logic
      const { error } = await supabase
        .rpc('add_agent_to_whatsapp_group', {
          agent_uuid: agentId,
          group_uuid: groupId,
        });

      if (error) throw error;

      return { error };
    } catch (error) {
      return { error };
    }
  }

  // Send WhatsApp message
  static async sendMessage(messageData: {
    groupId?: string;
    agentId?: string;
    phoneNumber: string;
    messageContent: string;
    messageType: 'text';
    mediaUrl?: string;
    location?: { lat: number; lng: number };
    templateId?: string;
    variables?: Record<string, any>;
  }): Promise<{ success: boolean; error?: string; messageId?: string }> {
    try {
      // Check if this is a template-based message
      let messageToSend = messageData.messageContent;
      let templateData;
      let messageId;

      if (messageData.templateId) {
        const { data: template } = await supabase
          .from('whatsapp_templates')
          .select('*')
          .eq('id', messageData.templateId)
          .single();

        if (template) {
          // Replace template variables
          templateData = template.message_content;
          if (messageData.variables) {
            Object.entries(messageData.variables).forEach(([key, value]) => {
              templateData = templateData.replace(`{{${key}}}`, String(value));
            });
          }
          messageId = 'template_' + messageData.templateId;
        }
      }

      // Mock WhatsApp API call - in production, this would integrate with actual WhatsApp Business API
      const whatsappApiUrl = 'https://graph.facebook.com/v18.0/2885483786936173';
      const accessToken = 'demo_access_token'; // In production, this would be from secure storage

       const payload = {
         messaging_product: 'whatsapp',
         to: messageData.phoneNumber,
         type: messageData.messageType,
         ...(messageData.mediaUrl && { media: { link: messageData.mediaUrl } }),
         ...(messageData.location && { location: { latitude: messageData.location.lat, longitude: messageData.location.lng } }),
         ...(messageId && { context: { message_id: messageId } }),
         ...(templateData && { template: { name: templateData, language: { code: 'en' } } }),
         text: { body: messageToSend }
       };

      const response = await fetch(whatsappApiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

       if (result.success || true) { // Mock success for demo
         // Log the message
         await this.logWhatsAppMessage(messageId || 'temp', messageData.phoneNumber, messageToSend, messageData.agentId, messageData.groupId, 'sent', result.messages?.[0]?.id);

         return { 
           success: true, 
           messageId: result.messages?.[0]?.id || 'demo_' + Date.now()
         };
       } else {
         // Log the error
         await this.logWhatsAppMessage(messageId || 'temp', messageData.phoneNumber, messageToSend, messageData.agentId, messageData.groupId, 'failed', result.error);
         
         return { 
           success: false, 
           error: result.error || 'Unknown error'
         };
       }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Send bulk messages
  static async sendBulkMessages(messages: Array<{
    groupId?: string;
    agentId?: string;
    phoneNumber: string;
    messageContent: string;
    messageType?: string;
    delayBetween?: number;
  }>): Promise<Array<{ success: boolean; messageId?: string; error?: string }>> {
    const results = [];
    
    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      
      if (i > 0 && delayBetween) {
        await new Promise(resolve => setTimeout(resolve, delayBetween * 1000)); // delay between messages
      }

      const result = await this.sendMessage(message);
      results.push(result);
      
      // Add delay before next message
      await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
    }

    return results;
  }

   // Broadcast to group
   static async broadcastToGroup(
     groupId: string,
     messageContent: string,
     messageType: 'text' = 'text',
     templateId?: string,
     variables?: Record<string, any>,
   ): Promise<{ success: boolean; sentCount: number; error?: string }> {
    try {
      const { data: group } = await supabase
        .from('whatsapp_groups')
        .select('phone_numbers')
        .eq('id', groupId)
        .single();

      if (!group || !group.phone_numbers.length) {
        return { success: false, error: 'Group not found or has no phone numbers' };
      }

      // Send to all group members
      const results = await this.sendBulkMessages(
        group.phone_numbers.map(phone => ({
          groupId,
          messageContent,
          phoneNumber: phone,
          messageType,
        }))
      );

      const successCount = results.filter(r => r.success).length;

      return { success: successCount > 0, sentCount: results.length };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Get WhatsApp groups
  static async getGroups(): Promise<{ data: WhatsAppGroup[]; error?: any }> {
    try {
      const { data, error } = await supabase
        .from('whatsapp_groups')
        .select('*')
        .order('created_at', { ascending: false });

      return { data: data as WhatsAppGroup[], error };
    } catch (error) {
      return { error };
    }
  }

  // Get messages with optional parameters
  static async getMessages(options?: { 
    limit?: number; 
    groupId?: string;
    agentId?: string;
  }): Promise<{ data: WhatsAppMessage[]; error?: any }> {
    try {
      let query = supabase
        .from('whatsapp_messages')
        .select(`
          *,
          agents (
            full_name,
            phone_number
          ),
          whatsapp_groups (
            group_name
          )
        `)
        .order('created_at', { ascending: false });

      if (options?.limit) {
        query = query.limit(options.limit);
      }
      if (options?.groupId) {
        query = query.eq('group_id', options.groupId);
      }
      if (options?.agentId) {
        query = query.eq('agent_id', options.agentId);
      }

      const { data, error } = await query;

      return { data: data as WhatsAppMessage[], error };
    } catch (error) {
      return { error };
    }
  }

  // Get messages for a group (backward compatibility)
  static async getGroupMessages(groupId: string): Promise<{ data: WhatsAppMessage[]; error?: any }> {
    return this.getMessages({ groupId });
  }

  // Get messages for an agent
  static async getAgentMessages(agentId: string): Promise<{ data: WhatsAppMessage[]; error?: any }> {
    try {
      const { data, error } = await supabase
        .from('whatsapp_messages')
        .select(`
          *,
          agents (
            full_name,
            phone_number
          )
        `)
        .eq('agent_id', agentId)
        .order('created_at', { ascending: false });

      return { data: data as WhatsAppMessage[], error };
    } catch (error) {
      return { error };
    }
  }

  // Get WhatsApp analytics
  static async getAnalytics(dateRange?: { from: string; to: string }): Promise<{ data: WhatsAppAnalytics[]; error?: any }> {
    try {
      let query = supabase
        .from('whatsapp_analytics')
        .select('*')
        .order('date', { ascending: false });

      if (dateRange?.from) {
        query = query.gte('date', dateRange.from);
      }
      if (dateRange?.to) {
        query = query.lte('date', dateRange.to);
      }

      const { data, error } = await query;

      return { data: data as WhatsAppAnalytics[], error };
    } catch (error) {
      return { error };
    }
  }

  // Get WhatsApp templates
  static async getTemplates(category?: string): Promise<{ data: WhatsAppTemplate[]; error?: any }> {
    try {
      let query = supabase
        .from('whatsapp_templates')
        .select('*')
        .order('created_at', { ascending: false });

      if (category) {
        query = query.eq('category', category);
      }

      const { data, error } = await query;

      return { data: data as WhatsAppTemplate[], error };
    } catch (error) {
      return { error };
    }
  }

  // Log WhatsApp message (internal)
  private static async logWhatsAppMessage(
    messageId: string,
    phoneNumber: string,
    messageContent: string,
    agentId?: string,
    groupId?: string,
    status: 'pending' | 'sent' | 'delivered' | 'failed' | 'cancelled',
    details?: Record<string, any>,
    errorMessage?: string
  ): Promise<void> {
    try {
      await supabase
        .from('whatsapp_messages')
        .insert({
          group_id: groupId,
          agent_id: agentId,
          message_content: messageContent,
          message_type: 'text',
          status: status,
          error_message: errorMessage,
          whatsapp_message_id: messageId,
          created_at: new Date().toISOString(),
        });

      // Also log to general audit log
      await supabase
        .from('audit_logs')
        .insert({
          user_id: (await supabase.auth.getUser()).data.user?.id || 'system',
          action: 'WHATSAPP_MESSAGE_SENT',
          resource_type: 'whatsapp',
          resource_id: groupId || agentId,
          details: {
            phone_number: phoneNumber,
            message_type: 'text',
            status: status,
            errorMessage: errorMessage
          },
          timestamp: new Date().toISOString()
        });
    } catch (error) {
      console.error('Failed to log WhatsApp message:', error);
    }
  }
}