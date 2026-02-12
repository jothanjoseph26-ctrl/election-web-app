/**
 * Paystack Payment Provider Implementation
 * Handles Paystack-specific payment processing for Nigeria
 */

import { BasePaymentProvider, PaymentProvider, PaymentMethod, PaymentStatus, type PaymentRequest, type PaymentResponse, type AccountVerificationRequest, type AccountVerificationResponse, type TransactionStatusResponse, type WebhookEvent, type Recipient } from './base';

export interface PaystackConfig {
  secretKey: string;
  publicKey?: string;
  webhookSecret?: string;
  baseUrl?: string; // For sandbox/live switching
}

export interface PaystackTransferRecipient {
  type: string;
  name: string;
  account_number: string;
  bank_code: string;
  currency?: string;
}

export interface PaystackTransferRequest {
  source: string;
  amount: number;
  recipient: string;
  reference: string;
  reason?: string;
  currency?: string;
}

export interface PaystackAccountResolution {
  status: boolean;
  message: string;
  data: {
    account_number: string;
    account_name: string;
    bank_id: number;
  };
}

export class PaystackProvider extends BasePaymentProvider {
  private config: PaystackConfig;
  private baseUrl: string;

  constructor(config: PaystackConfig) {
    super(PaymentProvider.PAYSTACK, config.secretKey, config);
    this.config = config;
    
    // Use sandbox for testing if not explicitly set
    const isLive = !config.baseUrl?.includes('sandbox');
    this.baseUrl = config.baseUrl || `https://api.paystack.co`;
  }

  /**
   * Verify Nigerian bank account using Paystack's resolve endpoint
   */
  async verifyAccount(request: AccountVerificationRequest): Promise<AccountVerificationResponse> {
    try {
      const url = `${this.baseUrl}/bank/resolve`;
      const params = new URLSearchParams({
        account_number: request.accountNumber,
        bank_code: request.bankCode
      });

      const response = await fetch(`${url}?${params}`, {
        headers: {
          'Authorization': `Bearer ${this.config.secretKey}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      this.logApiCall('verifyAccount', { accountNumber: request.accountNumber, bankCode: request.bankCode }, data);

      if (data.status && data.data) {
        return {
          isValid: true,
          accountName: data.data.account_name,
          bankName: data.data.bank_name || 'Unknown'
        };
      } else {
        return {
          isValid: false,
          errorMessage: data.message || 'Account verification failed'
        };
      }
    } catch (error) {
      console.error('Paystack account verification error:', error);
      return {
        isValid: false,
        errorMessage: 'Network error during account verification'
      };
    }
  }

  /**
   * Initiate payment using Paystack transfer API
   */
  async initiatePayment(request: PaymentRequest): Promise<PaymentResponse> {
    try {
      const validationErrors = this.validateRequest(request);
      if (validationErrors.length > 0) {
        return {
          success: false,
          message: validationErrors.join(', ')
        };
      }

      // Step 1: Create transfer recipient
      const recipientResult = await this.createTransferRecipient(request.recipient);
      if (!recipientResult.success) {
        return recipientResult;
      }

      // Step 2: Initiate transfer
      const transferRequest: PaystackTransferRequest = {
        source: 'balance',
        amount: Math.round(request.amount * 100), // Convert to kobo
        recipient: recipientResult.recipientCode!,
        reference: request.reference,
        reason: request.description || 'Payment from AMAC',
        currency: request.currency || 'NGN'
      };

      const response = await fetch(`${this.baseUrl}/transfer`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.secretKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(transferRequest)
      });

      const data = await response.json();

      this.logApiCall('initiatePayment', transferRequest, data);

      if (data.status) {
        return {
          success: true,
          reference: data.data.reference,
          providerReference: data.data.id,
          status: this.mapPaystackStatus(data.data.status),
          message: data.data.message || 'Transfer initiated successfully',
          provider: PaymentProvider.PAYSTACK,
          fee: data.fee || 0
        };
      } else {
        return {
          success: false,
          message: data.message || 'Transfer initiation failed',
          provider: PaymentProvider.PAYSTACK
        };
      }
    } catch (error) {
      console.error('Paystack payment initiation error:', error);
      return {
        success: false,
        message: 'Network error during payment initiation',
        provider: PaymentProvider.PAYSTACK
      };
    }
  }

  /**
   * Check transaction status
   */
  async checkTransactionStatus(reference: string): Promise<TransactionStatusResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/transfer/verify/${reference}`, {
        headers: {
          'Authorization': `Bearer ${this.config.secretKey}`
        }
      });

      const data = await response.json();

      this.logApiCall('checkTransactionStatus', { reference }, data);

      if (data.status && data.data) {
        return {
          status: this.mapPaystackStatus(data.data.status),
          amount: data.data.amount / 100, // Convert from kobo
          reference: data.data.reference,
          providerReference: data.data.id,
          settledAmount: data.data.settlement_amount ? data.data.settlement_amount / 100 : undefined,
          fees: data.data.fees ? data.data.fees / 100 : undefined,
          failureReason: data.data.reason,
          timestamp: data.data.updated_at
        };
      } else {
        return {
          status: PaymentStatus.FAILED,
          reference,
          failureReason: data.message || 'Transaction verification failed'
        };
      }
    } catch (error) {
      console.error('Paystack status check error:', error);
      return {
        status: PaymentStatus.FAILED,
        reference,
        failureReason: 'Network error during status check'
      };
    }
  }

  /**
   * Process webhook events
   */
  async processWebhook(event: WebhookEvent): Promise<boolean> {
    try {
      // Verify webhook signature
      if (!this.verifyWebhookSignature(event.signature, JSON.stringify(event.data))) {
        console.error('Invalid webhook signature');
        return false;
      }

      const eventData = event.data;

      // Handle different event types
      switch (event.event) {
        case 'transfer.success':
          console.log('Transfer successful:', eventData);
          // Update payment status to successful in database
          break;
        
        case 'transfer.failed':
          console.log('Transfer failed:', eventData);
          // Update payment status to failed with reason
          break;
        
        case 'transfer.reversed':
          console.log('Transfer reversed:', eventData);
          // Handle transfer reversal
          break;
        
        default:
          console.log('Unhandled webhook event:', event.event);
      }

      return true;
    } catch (error) {
      console.error('Webhook processing error:', error);
      return false;
    }
  }

  /**
   * Get supported Nigerian banks from Paystack
   */
  async getSupportedBanks(): Promise<any[]> {
    try {
      const response = await fetch(`${this.baseUrl}/bank?country=nigeria&pay_with_bank=true`, {
        headers: {
          'Authorization': `Bearer ${this.config.secretKey}`
        }
      });

      const data = await response.json();
      
      if (data.status) {
        return data.data.map((bank: any) => ({
          code: bank.code,
          name: bank.name,
          slug: bank.slug,
          longCode: bank.longcode,
          gateway: bank.gateway,
          payWithBank: bank.pay_with_bank,
          active: bank.active,
          isDeleted: bank.is_deleted,
          country: bank.country,
          currency: bank.currency,
          type: bank.type
        }));
      }

      return [];
    } catch (error) {
      console.error('Error fetching banks:', error);
      return [];
    }
  }

  /**
   * Create transfer recipient
   */
  private async createTransferRecipient(recipient: Recipient): Promise<PaymentResponse & { recipientCode?: string }> {
    try {
      let recipientData: PaystackTransferRecipient;

      if (recipient.type === 'bank_account' && recipient.account) {
        recipientData = {
          type: 'nuban',
          name: recipient.account.accountName,
          account_number: recipient.account.accountNumber,
          bank_code: recipient.account.bankCode,
          currency: 'NGN'
        };
      } else {
        throw new Error('Unsupported recipient type for Paystack');
      }

      const response = await fetch(`${this.baseUrl}/transferrecipient`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.secretKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(recipientData)
      });

      const data = await response.json();

      this.logApiCall('createTransferRecipient', recipientData, data);

      if (data.status) {
        return {
          success: true,
          recipientCode: data.data.recipient_code,
          message: 'Recipient created successfully'
        };
      } else {
        return {
          success: false,
          message: data.message || 'Failed to create recipient'
        };
      }
    } catch (error) {
      console.error('Error creating transfer recipient:', error);
      return {
        success: false,
        message: 'Network error creating recipient'
      };
    }
  }

  /**
   * Map Paystack status to our PaymentStatus enum
   */
  private mapPaystackStatus(paystackStatus: string): PaymentStatus {
    const statusMap: { [key: string]: PaymentStatus } = {
      'success': PaymentStatus.SUCCESSFUL,
      'pending': PaymentStatus.PENDING,
      'processing': PaymentStatus.PROCESSING,
      'failed': PaymentStatus.FAILED,
      'reversed': PaymentStatus.REVERSED,
      'otp': PaymentStatus.PENDING
    };

    return statusMap[paystackStatus] || PaymentStatus.PENDING;
  }

  /**
   * Verify webhook signature
   */
  private verifyWebhookSignature(signature: string, payload: string): boolean {
    if (!this.config.webhookSecret) {
      console.warn('No webhook secret configured');
      return false;
    }

    try {
      const crypto = require('crypto');
      const hash = crypto
        .createHmac('sha512', this.config.webhookSecret)
        .update(payload)
        .digest('hex');

      return hash === signature;
    } catch (error) {
      console.error('Signature verification error:', error);
      return false;
    }
  }

  /**
   * Get balance from Paystack
   */
  async getBalance(): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/balance`, {
        headers: {
          'Authorization': `Bearer ${this.config.secretKey}`
        }
      });

      const data = await response.json();
      
      if (data.status) {
        return {
          success: true,
          balance: data.data[0]?.balance / 100, // Convert from kobo
          currency: data.data[0]?.currency || 'NGN'
        };
      }

      return { success: false, error: data.message };
    } catch (error) {
      console.error('Balance check error:', error);
      return { success: false, error: 'Network error' };
    }
  }

  /**
   * Validate Paystack-specific requirements
   */
  protected validateRequest(request: PaymentRequest): string[] {
    const errors = super.validateRequest(request);

    // Paystack minimum transfer amount is 1000 kobo (10 NGN)
    if (request.amount && request.amount < 10) {
      errors.push('Minimum transfer amount is ₦10');
    }

    // Check currency
    if (request.currency && request.currency !== 'NGN') {
      errors.push('Only NGN currency is supported');
    }

    return errors;
  }
}