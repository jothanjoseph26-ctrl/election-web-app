import { supabase } from '@/integrations/supabase/client';
import { PaymentManager, PaymentProviderFactory, type PaymentProviderConfig } from '@/lib/payment-providers/manager';
import { PaymentProvider } from '@/lib/payment-providers/base';
import { validateNUBAN, validateNigerianPhoneNumber, validatePaymentAmount, generatePaymentReference, getBankOptions } from '@/lib/nigerian-payments';

export interface PaymentRecord {
  id: string;
  agent_id: string;
  batch_id?: string;
  amount: number;
  payment_method: 'bank_transfer' | 'cash' | 'mobile_money' | 'cheque' | 'other';
  status: 'pending' | 'verified' | 'approved' | 'processing' | 'sent' | 'delivered' | 'failed' | 'cancelled' | 'reversed';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  reference_number?: string;
  transaction_id?: string;
  bank_name?: string;
  account_number?: string;
  account_name?: string;
  payment_date?: string;
  expected_delivery_date?: string;
  actual_delivery_date?: string;
  notes?: string;
  verification_notes?: string;
  approved_by?: string;
  approved_at?: string;
  sent_by?: string;
  sent_at?: string;
  confirmed_by?: string;
  confirmed_at?: string;
  failure_reason?: string;
  failure_code?: string;
  retry_count: number;
  max_retries: number;
  next_retry_at?: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  agent?: {
    full_name: string;
    phone_number: string;
    ward_name: string;
    ward_number: string;
    verification_status: string;
  };
}

export interface PaymentBatch {
  id: string;
  batch_name: string;
  description?: string;
  total_amount: number;
  total_agents: number;
  status: 'draft' | 'pending_approval' | 'approved' | 'processing' | 'completed' | 'failed' | 'cancelled';
  created_by?: string;
  approved_by?: string;
  approved_at?: string;
  processed_at?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface PaymentTemplate {
  id: string;
  template_name: string;
  description?: string;
  default_amount?: number;
  default_payment_method?: string;
  payment_terms: Record<string, any>;
  verification_rules: Record<string, any>;
  approval_required: boolean;
  active: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface PaymentVerification {
  id: string;
  payment_id: string;
  verification_type: 'amount' | 'recipient' | 'reference' | 'bank_details' | 'duplicate_check';
  status: 'pending' | 'passed' | 'failed' | 'skipped';
  details?: Record<string, any>;
  verified_by?: string;
  verified_at?: string;
  notes?: string;
  created_at: string;
}

export interface PaymentDelivery {
  id: string;
  payment_id: string;
  delivery_method: 'in_person' | 'bank_deposit' | 'mobile_transfer' | 'courier' | 'email';
  tracking_number?: string;
  delivery_status: 'pending' | 'in_transit' | 'delivered' | 'failed' | 'returned' | 'cancelled';
  delivery_address?: string;
  recipient_name?: string;
  recipient_phone?: string;
  recipient_signature?: string;
  photo_proof_url?: string;
  location_lat?: number;
  location_lng?: number;
  attempted_at?: string;
  delivered_at?: string;
  notes?: string;
  delivery_agent_id?: string;
  created_at: string;
  updated_at: string;
}

export interface PaymentReconciliation {
  id: string;
  payment_id: string;
  reconciliation_date: string;
  opening_balance: number;
  closing_balance: number;
  difference: number;
  reconciled_by?: string;
  reconciled_at?: string;
  status: 'matched' | 'unmatched' | 'variance' | 'exception';
  variance_reason?: string;
  attached_documents: string[];
  notes?: string;
  created_at: string;
}

// Initialize Nigerian payment providers
let paymentManager: PaymentManager;

const initializePaymentProviders = () => {
  if (!paymentManager) {
    const config: PaymentProviderConfig = {
      primaryProvider: process.env.NEXT_PUBLIC_PRIMARY_PAYMENT_PROVIDER as PaymentProvider || PaymentProvider.PAYSTACK,
      fallbackProviders: [PaymentProvider.FLUTTERWAVE], // Fallback to Flutterwave
      providers: {
        paystack: {
          secretKey: process.env.PAYSTACK_SECRET_KEY!,
          publicKey: process.env.PAYSTACK_PUBLIC_KEY,
          webhookSecret: process.env.PAYSTACK_WEBHOOK_SECRET,
          baseUrl: process.env.PAYSTACK_BASE_URL // Optional: for sandbox/live switching
        },
        flutterwave: {
          secretKey: process.env.FLUTTERWAVE_SECRET_KEY!,
          publicKey: process.env.FLUTTERWAVE_PUBLIC_KEY,
          encryptionKey: process.env.FLUTTERWAVE_ENCRYPTION_KEY,
          webhookSecret: process.env.FLUTTERWAVE_WEBHOOK_SECRET,
          baseUrl: process.env.FLUTTERWAVE_BASE_URL // Optional: for sandbox/live switching
        }
      },
      autoFallback: true,
      retryAttempts: 3
    };

    paymentManager = new PaymentManager(config);
  }
  return paymentManager;
};

export class PaymentService {
  // Create new payment record
  static async createPayment(paymentData: Partial<PaymentRecord>): Promise<{ data?: PaymentRecord; error?: any }> {
    try {
      // Validate Nigerian bank details if provided
      if (paymentData.account_number && paymentData.payment_method === 'bank_transfer') {
        const accountValidation = validateNUBAN(paymentData.account_number, paymentData.bank_name);
        if (!accountValidation.isValid) {
          return { error: { message: accountValidation.errors.join(', ') } };
        }
      }

      // Validate payment amount
      if (paymentData.amount) {
        const amountValidation = validatePaymentAmount(paymentData.amount);
        if (!amountValidation.isValid) {
          return { error: { message: amountValidation.errors.join(', ') } };
        }
      }

      // Generate Nigerian-specific reference if not provided
      const referenceNumber = paymentData.reference_number || generatePaymentReference();

      const { data, error } = await supabase
        .from('payment_records')
        .insert({
          agent_id: paymentData.agent_id!,
          amount: paymentData.amount!,
          payment_method: paymentData.payment_method!,
          priority: paymentData.priority || 'normal',
          reference_number: referenceNumber,
          bank_name: paymentData.bank_name,
          account_number: paymentData.account_number,
          account_name: paymentData.account_name,
          payment_date: paymentData.payment_date,
          expected_delivery_date: paymentData.expected_delivery_date,
          notes: paymentData.notes,
          transaction_id: null, // Will be populated by provider
        })
        .select(`
          *,
          agents (
            full_name,
            phone_number,
            ward_name,
            ward_number,
            verification_status
          )
        `)
        .single();

      if (error) throw error;

      // Send notification to agent
      if (data) {
        await this.sendPaymentNotification(data.agent_id!, data, 'created');
      }

      return { data: data as PaymentRecord };
    } catch (error) {
      return { error };
    }
  }

  // Create payment batch
  static async createPaymentBatch(batchData: Partial<PaymentBatch>): Promise<{ data?: PaymentBatch; error?: any }> {
    try {
      const { data, error } = await supabase
        .from('payment_batches')
        .insert({
          batch_name: batchData.batch_name!,
          description: batchData.description,
          total_amount: batchData.total_amount || 0,
          total_agents: batchData.total_agents || 0,
          status: 'draft',
          notes: batchData.notes,
        })
        .select('*')
        .single();

      if (error) throw error;
      return { data: data as PaymentBatch };
    } catch (error) {
      return { error };
    }
  }

  // Get payment records with filters
  static async getPaymentRecords(filters: {
    status?: string;
    agentId?: string;
    batchId?: string;
    paymentMethod?: string;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ data: PaymentRecord[]; error?: any }> {
    let query = supabase
      .from('payment_records')
      .select(`
        *,
        agents (
          full_name,
          phone_number,
          ward_name,
          ward_number,
          verification_status
        )
      `)
      .order('created_at', { ascending: false });

    // Apply filters
    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.agentId) {
      query = query.eq('agent_id', filters.agentId);
    }
    if (filters.batchId) {
      query = query.eq('batch_id', filters.batchId);
    }
    if (filters.paymentMethod) {
      query = query.eq('payment_method', filters.paymentMethod);
    }
    if (filters.dateFrom) {
      query = query.gte('payment_date', filters.dateFrom);
    }
    if (filters.dateTo) {
      query = query.lte('payment_date', filters.dateTo);
    }

    // Apply pagination
    if (filters.limit) {
      query = query.limit(filters.limit);
    }
    if (filters.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1);
    }

    const { data, error } = await query;
    return { data: data as PaymentRecord[], error };
  }

  // Update payment status (workflow)
  static async updatePaymentStatus(
    paymentId: string, 
    newStatus: string, 
    notes?: string
  ): Promise<{ error?: any }> {
    try {
      // Call the database function for workflow validation
      const { error } = await supabase.rpc('advance_payment_workflow', {
        payment_uuid: paymentId,
        new_status: newStatus,
        notes: notes,
      });

      if (error) throw error;

      // Get updated payment record for notification
      const { data: updatedPayment } = await supabase
        .from('payment_records')
        .select('agent_id, amount, reference_number')
        .eq('id', paymentId)
        .single();

      if (updatedPayment) {
        await this.sendPaymentNotification(updatedPayment.agent_id, updatedPayment, newStatus as any);
      }

      return {};
    } catch (error) {
      return { error };
    }
  }

  // Bulk upload payments from CSV
  static async bulkUploadPayments(
    payments: Partial<PaymentRecord>[],
    batchId?: string
  ): Promise<{ success: number; failed: number; errors: any[] }> {
    const results = { success: 0, failed: 0, errors: [] as any[] };

    for (const payment of payments) {
      try {
        const { error } = await this.createPayment({
          ...payment,
          batch_id: batchId,
        });

        if (error) {
          results.failed++;
          results.errors.push({ payment, error: error.message });
        } else {
          results.success++;
        }
      } catch (error) {
        results.failed++;
        results.errors.push({ payment, error: error.message });
      }
    }

    return results;
  }

  // Verify payment
  static async verifyPayment(
    paymentId: string, 
    verificationType: string, 
    status: string, 
    notes?: string
  ): Promise<{ error?: any }> {
    try {
      const { error } = await supabase
        .from('payment_verifications')
        .insert({
          payment_id: paymentId,
          verification_type: verificationType,
          status: status,
          notes: notes,
        });

      return { error };
    } catch (error) {
      return { error };
    }
  }

  // Get payment batches
  static async getPaymentBatches(): Promise<{ data: PaymentBatch[]; error?: any }> {
    const { data, error } = await supabase
      .from('payment_batches')
      .select('*')
      .order('created_at', { ascending: false });

    return { data: data as PaymentBatch[], error };
  }

  // Get payment statistics
  static async getPaymentStats(dateRange?: { from: string; to: string }): Promise<{
    total: number;
    pending: number;
    sent: number;
    delivered: number;
    failed: number;
    byMethod: Record<string, number>;
    byStatus: Record<string, number>;
  }> {
    let query = supabase
      .from('payment_records')
      .select('*');

    if (dateRange) {
      query = query
        .gte('payment_date', dateRange.from)
        .lte('payment_date', dateRange.to);
    }

    const { data: payments, error } = await query;

    if (error || !payments) {
      return {
        total: 0,
        pending: 0,
        sent: 0,
        delivered: 0,
        failed: 0,
        byMethod: {},
        byStatus: {},
      };
    }

    const stats = {
      total: payments.length,
      pending: 0,
      sent: 0,
      delivered: 0,
      failed: 0,
      byMethod: {} as Record<string, number>,
      byStatus: {} as Record<string, number>,
    };

    payments.forEach(payment => {
      // Count by status
      stats.byStatus[payment.status] = (stats.byStatus[payment.status] || 0) + 1;
      
      // Count by method
      stats.byMethod[payment.payment_method] = (stats.byMethod[payment.payment_method] || 0) + 1;
      
      // Count main categories
      switch (payment.status) {
        case 'pending':
        case 'verified':
        case 'approved':
          stats.pending++;
          break;
        case 'processing':
        case 'sent':
          stats.sent++;
          break;
        case 'delivered':
          stats.delivered++;
          break;
        case 'failed':
        case 'cancelled':
          stats.failed++;
          break;
      }
    });

    return stats;
  }

  // Get payment templates
  static async getPaymentTemplates(): Promise<{ data: PaymentTemplate[]; error?: any }> {
    const { data, error } = await supabase
      .from('payment_templates')
      .select('*')
      .eq('active', true)
      .order('template_name');

    return { data: data as PaymentTemplate[], error };
  }

  // Create payment from template
  static async createPaymentFromTemplate(
    templateId: string,
    agentId: string,
    customizations?: Partial<PaymentRecord>
  ): Promise<{ data?: PaymentRecord; error?: any }> {
    try {
      // Get template
      const { data: template, error: templateError } = await supabase
        .from('payment_templates')
        .select('*')
        .eq('id', templateId)
        .single();

      if (templateError || !template) {
        return { error: templateError || new Error('Template not found') };
      }

      // Create payment using template defaults
      const paymentData = {
        agent_id: agentId,
        amount: customizations?.amount || template.default_amount || 0,
        payment_method: customizations?.payment_method || template.default_payment_method || 'bank_transfer',
        priority: template.payment_terms?.priority || 'normal',
        notes: template.description,
        ...customizations,
      };

      return await this.createPayment(paymentData);
    } catch (error) {
      return { error };
    }
  }

  // Send payment notification
  private static async sendPaymentNotification(
    agentId: string, 
    payment: any, 
    status: string
  ): Promise<void> {
    try {
      const { data: agent } = await supabase
        .from('agents')
        .select('full_name, phone_number')
        .eq('id', agentId)
        .single();

      if (!agent) return;

      let message = '';
      switch (status) {
        case 'created':
          message = `AMAC: Payment of ₦${payment.amount} has been initiated. Reference: ${payment.reference_number || 'Pending'}. We'll notify you when it's approved.`;
          break;
        case 'approved':
        case 'sent':
          message = `AMAC: Payment of ₦${payment.amount} has been sent. Reference: ${payment.reference_number}. Please confirm receipt.`;
          break;
        case 'delivered':
          message = `AMAC: Payment of ₦${payment.amount} has been confirmed. Reference: ${payment.reference_number}. Thank you!`;
          break;
        case 'failed':
          message = `AMAC: There was an issue with your payment. Please contact the administrator. Reference: ${payment.reference_number}`;
          break;
        default:
          message = `AMAC: Your payment status has been updated. Reference: ${payment.reference_number}`;
      }

      // Create notification record
      await supabase
        .from('payment_notifications')
        .insert({
          payment_id: payment.id,
          notification_type: status === 'created' ? 'created' : status === 'delivered' ? 'delivered' : 'reminder',
          recipient_type: 'agent',
          recipient_id: agent.phone_number,
          channel: 'sms',
          message: message,
        });

      // Send SMS (this would integrate with your SMS service)
      // await SMSCommunicationService.sendSMS(agent.phone_number!, message);
    } catch (error) {
      console.error('Failed to send payment notification:', error);
    }
  }

  // Get failed payments for retry
  static async getFailedPayments(maxRetries?: number): Promise<{ data: PaymentRecord[]; error?: any }> {
    let query = supabase
      .from('payment_records')
      .select(`
        *,
        agents (
          full_name,
          phone_number,
          ward_name,
          ward_number
        )
      `)
      .eq('status', 'failed')
      .lt('retry_count', maxRetries || 3)
      .or('next_retry_at.is.null,next_retry_at.lte.now()');

    const { data, error } = await query.order('created_at', { ascending: true });
    return { data: data as PaymentRecord[], error };
  }

  // Retry failed payment
  static async retryPayment(paymentId: string): Promise<{ error?: any }> {
    try {
      // Reset to pending status
      const { error } = await this.updatePaymentStatus(paymentId, 'pending', 'Retry attempt');

      if (error) throw error;

      // Log retry attempt
      await supabase
        .from('audit_logs')
        .insert({
          user_id: (await supabase.auth.getUser()).data.user?.id,
          action: 'PAYMENT_RETRY',
          resource_type: 'payment',
          resource_id: paymentId,
          details: { timestamp: new Date().toISOString() },
        });

      return {};
    } catch (error) {
      return { error };
    }
  }

  // Search payments
  static async searchPayments(query: string, filters?: {
    agentId?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<{ data: PaymentRecord[]; error?: any }> {
    let dbQuery = supabase
      .from('payment_records')
      .select(`
        *,
        agents!inner (
          full_name,
          phone_number,
          ward_name,
          ward_number
        )
      `)
      .or(`
        reference_number.ilike.%${query}%,
        transaction_id.ilike.%${query}%,
        agents.full_name.ilike.%${query}%,
        agents.phone_number.ilike.%${query}%
      `)
      .order('created_at', { ascending: false });

    // Apply additional filters
    if (filters) {
      if (filters.agentId) {
        dbQuery = dbQuery.eq('agent_id', filters.agentId);
      }
      if (filters.status) {
        dbQuery = dbQuery.eq('status', filters.status);
      }
      if (filters.dateFrom) {
        dbQuery = dbQuery.gte('payment_date', filters.dateFrom);
      }
      if (filters.dateTo) {
        dbQuery = dbQuery.lte('payment_date', filters.dateTo);
      }
    }

    const { data, error } = await dbQuery;
    return { data: data as PaymentRecord[], error };
  }

  // Nigerian Payment Provider Integration Methods

  /**
   * Process real payment using Nigerian payment providers
   */
  static async processPaymentWithProvider(
    paymentRecord: PaymentRecord,
    provider?: PaymentProvider
  ): Promise<{ success: boolean; transactionId?: string; error?: any }> {
    try {
      const manager = initializePaymentProviders();
      
      const paymentRequest = {
        amount: paymentRecord.amount,
        currency: 'NGN',
        reference: paymentRecord.reference_number,
        recipient: this.buildRecipient(paymentRecord),
        description: `Payment to ${paymentRecord.agent?.full_name || 'Agent'} for AMAC services`,
        metadata: {
          paymentRecordId: paymentRecord.id,
          agentId: paymentRecord.agent_id,
          wardNumber: paymentRecord.agent?.ward_number,
          paymentMethod: paymentRecord.payment_method
        }
      };

      const result = await manager.processPayment(paymentRequest);

      if (result.success) {
        // Update payment record with provider information
        await supabase
          .from('payment_records')
          .update({
            transaction_id: result.providerReference,
            status: 'sent', // Update to sent since payment was initiated
            sent_at: new Date().toISOString(),
            notes: `${paymentRecord.notes || ''}\nProcessed via ${result.provider}`
          })
          .eq('id', paymentRecord.id);

        return {
          success: true,
          transactionId: result.reference
        };
      } else {
        // Mark as failed
        await supabase
          .from('payment_records')
          .update({
            status: 'failed',
            failure_reason: result.message,
            failure_code: 'PAYMENT_FAILED'
          })
          .eq('id', paymentRecord.id);

        return {
          success: false,
          error: { message: result.message }
        };
      }
    } catch (error) {
      console.error('Payment processing error:', error);
      return {
        success: false,
        error
      };
    }
  }

  /**
   * Verify Nigerian bank account
   */
  static async verifyNigerianBankAccount(
    accountNumber: string,
    bankCode: string
  ): Promise<{ isValid: boolean; accountName?: string; bankName?: string; error?: any }> {
    try {
      const manager = initializePaymentProviders();
      
      const result = await manager.verifyAccount({
        accountNumber,
        bankCode
      });

      return {
        isValid: result.isValid,
        accountName: result.accountName,
        bankName: result.bankName,
        error: result.errorMessage ? { message: result.errorMessage } : undefined
      };
    } catch (error) {
      console.error('Account verification error:', error);
      return {
        isValid: false,
        error
      };
    }
  }

  /**
   * Get supported Nigerian banks
   */
  static async getSupportedBanks(): Promise<{ code: string; name: string; slug?: string }[]> {
    try {
      const manager = initializePaymentProviders();
      return await manager.getSupportedBanks();
    } catch (error) {
      console.error('Error fetching banks:', error);
      return [];
    }
  }

  /**
   * Process payment for mobile money (OPay, Paga, etc.)
   */
  static async processMobileMoneyPayment(
    paymentRecord: PaymentRecord,
    mobileMoneyProvider: string,
    phoneNumber: string
  ): Promise<{ success: boolean; reference?: string; error?: any }> {
    try {
      const manager = initializePaymentProviders();

      const paymentRequest = {
        amount: paymentRecord.amount,
        currency: 'NGN',
        reference: paymentRecord.reference_number,
        recipient: {
          type: 'mobile_money' as const,
          mobileMoney: {
            phoneNumber,
            provider: mobileMoneyProvider,
            providerName: this.getMobileMoneyProviderName(mobileMoneyProvider)
          }
        },
        description: `Mobile money payment to ${paymentRecord.agent?.full_name || 'Agent'}`,
        metadata: {
          paymentRecordId: paymentRecord.id,
          agentId: paymentRecord.agent_id,
          paymentMethod: 'mobile_money',
          mobileMoneyProvider
        }
      };

      const result = await manager.processPayment(paymentRequest);

      if (result.success) {
        // Update payment record
        await supabase
          .from('payment_records')
          .update({
            transaction_id: result.providerReference,
            status: 'sent',
            sent_at: new Date().toISOString(),
            notes: `${paymentRecord.notes || ''}\nMobile money payment via ${mobileMoneyProvider}`
          })
          .eq('id', paymentRecord.id);

        return {
          success: true,
          reference: result.reference
        };
      } else {
        await supabase
          .from('payment_records')
          .update({
            status: 'failed',
            failure_reason: result.message,
            failure_code: 'MOBILE_MONEY_FAILED'
          })
          .eq('id', paymentRecord.id);

        return {
          success: false,
          error: { message: result.message }
        };
      }
    } catch (error) {
      console.error('Mobile money payment error:', error);
      return {
        success: false,
        error
      };
    }
  }

  /**
   * Process USSD payment
   */
  static async processUSSDPayment(
    paymentRecord: PaymentRecord
  ): Promise<{ success: boolean; reference?: string; error?: any }> {
    try {
      const manager = initializePaymentProviders();

      // For USSD, we create a payment request that will be processed via USSD
      const paymentRequest = {
        amount: paymentRecord.amount,
        currency: 'NGN',
        reference: paymentRecord.reference_number,
        recipient: this.buildRecipient(paymentRecord),
        description: `USSD payment to ${paymentRecord.agent?.full_name || 'Agent'}`,
        metadata: {
          paymentRecordId: paymentRecord.id,
          agentId: paymentRecord.agent_id,
          paymentMethod: 'ussd'
        }
      };

      const result = await manager.processPayment(paymentRequest);

      if (result.success) {
        // Update payment record
        await supabase
          .from('payment_records')
          .update({
            transaction_id: result.providerReference,
            status: 'sent',
            sent_at: new Date().toISOString(),
            notes: `${paymentRecord.notes || ''}\nUSSD payment initiated`
          })
          .eq('id', paymentRecord.id);

        return {
          success: true,
          reference: result.reference
        };
      } else {
        await supabase
          .from('payment_records')
          .update({
            status: 'failed',
            failure_reason: result.message,
            failure_code: 'USSD_FAILED'
          })
          .eq('id', paymentRecord.id);

        return {
          success: false,
          error: { message: result.message }
        };
      }
    } catch (error) {
      console.error('USSD payment error:', error);
      return {
        success: false,
        error
      };
    }
  }

  /**
   * Get payment provider status and health
   */
  static async getProviderStatus(): Promise<{ providers: any; healthyProviders: PaymentProvider[] }> {
    try {
      const manager = initializePaymentProviders();
      const healthStatus = await manager.getProviderHealth();
      
      const providers = {
        primary: manager.getPrimaryProvider()?.getProvider(),
        available: PaymentProviderFactory.getAllProviders().map(p => p.getProvider()),
        status: Object.fromEntries(healthStatus)
      };

      const healthyProviders = Array.from(healthStatus.entries())
        .filter(([_, healthy]) => healthy)
        .map(([provider]) => provider);

      return { providers, healthyProviders };
    } catch (error) {
      console.error('Error checking provider status:', error);
      return { providers: [], healthyProviders: [] };
    }
  }

  /**
   * Handle webhook from payment providers
   */
  static async handlePaymentWebhook(
    provider: PaymentProvider,
    signature: string,
    payload: any
  ): Promise<{ success: boolean; error?: any }> {
    try {
      const manager = initializePaymentProviders();
      const success = await manager.processWebhook(provider, signature, payload);

      if (success) {
        // Update payment status based on webhook
        const { reference, status, providerReference } = payload.data || payload;
        
        if (reference && status) {
          await supabase
            .from('payment_records')
            .update({
              status: this.mapProviderStatus(status),
              transaction_id: providerReference,
              confirmed_at: new Date().toISOString()
            })
            .eq('reference_number', reference);
        }
      }

      return { success };
    } catch (error) {
      console.error('Webhook handling error:', error);
      return {
        success: false,
        error
      };
    }
  }

  /**
   * Build recipient object from payment record
   */
  private static buildRecipient(paymentRecord: PaymentRecord) {
    if (paymentRecord.payment_method === 'bank_transfer' && paymentRecord.account_number && paymentRecord.bank_name) {
      return {
        type: 'bank_account' as const,
        account: {
          accountNumber: paymentRecord.account_number,
          accountName: paymentRecord.account_name || 'Account Holder',
          bankCode: paymentRecord.bank_name, // Assume bank_name contains bank_code in this context
          bankName: paymentRecord.bank_name
        }
      };
    }
    
    throw new Error('Unsupported payment method for recipient building');
  }

  /**
   * Get mobile money provider display name
   */
  private static getMobileMoneyProviderName(provider: string): string {
    const providerNames: { [key: string]: string } = {
      'PAGA': 'Paga',
      'OPAY': 'OPay',
      'MTN_MOMO': 'MTN MoMo',
      'AIRTEL_TIGO': 'AirtelTigo Money',
      'GLO': 'Glo Cash'
    };
    
    return providerNames[provider] || provider;
  }

  /**
   * Map provider status to payment status
   */
  private static mapProviderStatus(providerStatus: string): string {
    const statusMap: { [key: string]: string } = {
      'success': 'delivered',
      'successful': 'delivered',
      'completed': 'delivered',
      'failed': 'failed',
      'failed': 'failed',
      'pending': 'pending',
      'processing': 'sent'
    };
    
    return statusMap[providerStatus] || 'pending';
  }
}