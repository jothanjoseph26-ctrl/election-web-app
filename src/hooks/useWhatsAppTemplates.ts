import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { WhatsAppService } from '@/services/whatsapp.service';
import type { WhatsAppTemplate } from '@/services/whatsapp.service';

export interface TemplateFormData {
  template_name: string;
  category: 'broadcast' | 'payment_reminder' | 'emergency_alert' | 'verification_request' | 'welcome';
  message_content: string;
  variables?: Record<string, any>;
  auto_send: boolean;
  conditions?: Record<string, any>;
}

export function useWhatsAppTemplates() {
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async (category?: string) => {
    try {
      setLoading(true);
      const { data, error } = await WhatsAppService.getTemplates(category);
      
      if (error) throw error;
      
      setTemplates(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch templates');
    } finally {
      setLoading(false);
    }
  };

  const createTemplate = async (formData: TemplateFormData): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data, error } = await supabase
        .from('whatsapp_templates')
        .insert({
          template_name: formData.template_name,
          category: formData.category,
          message_content: formData.message_content,
          variables: formData.variables || {},
          auto_send: formData.auto_send,
          conditions: formData.conditions || {},
        })
        .select()
        .single();

      if (error) throw error;

      setTemplates(prev => [data, ...prev]);
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to create template' };
    }
  };

  const updateTemplate = async (id: string, formData: Partial<TemplateFormData>): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data, error } = await supabase
        .from('whatsapp_templates')
        .update({
          ...formData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      setTemplates(prev => prev.map(t => t.id === id ? data : t));
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to update template' };
    }
  };

  const deleteTemplate = async (id: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await supabase
        .from('whatsapp_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setTemplates(prev => prev.filter(t => t.id !== id));
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to delete template' };
    }
  };

  const testTemplate = async (templateId: string, phoneNumber: string, variables?: Record<string, any>): Promise<{ success: boolean; error?: string }> => {
    try {
      const result = await WhatsAppService.sendMessage({
        phoneNumber,
        messageContent: '',
        messageType: 'text',
        templateId,
        variables,
      });

      return { success: result.success, error: result.error };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to send test message' };
    }
  };

  return {
    templates,
    loading,
    error,
    fetchTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    testTemplate,
  };
}