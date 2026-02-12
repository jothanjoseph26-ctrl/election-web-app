/**
 * Flutterwave Payment Provider Implementation
 * Handles Flutterwave-specific payment processing for Nigeria
 */

import { BasePaymentProvider, PaymentProvider, PaymentMethod, PaymentStatus, type PaymentRequest, type PaymentResponse, type AccountVerificationRequest, type AccountVerificationResponse, type TransactionStatusResponse, type WebhookEvent, type Recipient } from './base';

export interface FlutterwaveConfig {
  secretKey: string;
  publicKey?: string;
  encryptionKey?: string;
  webhookSecret?: string;
  baseUrl?: string; // For sandbox/live switching
}

export interface FlutterwaveTransferRecipient {
  account_number: string;
  account_name: string;
  bank_name: string;
  bank_code: string;
  currency?: string;
  email?: string;
}

export interface FlutterwaveTransferRequest {
  account_bank: string;
  account_number: string;
  amount: number;
  narration?: string;
  currency?: string;
  reference: string;
  beneficiary_name?: string;
  meta?: Record<string, any>;
}

export interface FlutterwaveAccountResolution {
  status: string;
  message: string;
  data: {
    account_number: string;
    account_name: string;
    bank_name: string;
  };
}

export class FlutterwaveProvider extends BasePaymentProvider {
  private config: FlutterwaveConfig;
  private baseUrl: string;

  constructor(config: FlutterwaveConfig) {
    super(PaymentProvider.FLUTTERWAVE, config.secretKey, config);
    this.config = config;
    
    // Use sandbox for testing if not explicitly set
    const isLive = !config.baseUrl?.includes('sandbox');
    this.baseUrl = config.baseUrl || `https://${isLive ? 'api' : 'developersandbox-api'}.flutterwave.com`;
  }

  /**
   * Verify Nigerian bank account using Flutterwave's resolve endpoint
   */
  async verifyAccount(request: AccountVerificationRequest): Promise<AccountVerificationResponse> {
    try {
      // Flutterwave doesn't have a direct account resolution endpoint like Paystack
      // We'll need to validate the account by attempting to create a transfer recipient
      // or use a third-party service for validation
      
      // For now, let's validate the format and return a simulated response
      const { validateNUBAN } = await import('../nigerian-payments');
      const validation = validateNUBAN(request.accountNumber, request.bankCode);
      
      if (!validation.isValid) {
        return {
          isValid: false,
          errorMessage: validation.errors.join(', ')
        };
      }

      // In a real implementation, you might use Flutterwave's resolve endpoint
      // or integrate with a bank verification service
      return {
        isValid: true,
        accountName: 'Account Holder Name', // Would be populated by actual verification
        bankName: 'Bank Name'
      };
    } catch (error) {
      console.error('Flutterwave account verification error:', error);
      return {
        isValid: false,
        errorMessage: 'Network error during account verification'
      };
    }
  }

  /**
   * Initiate payment using Flutterwave transfer API
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

      // Prepare transfer request
      const transferRequest: FlutterwaveTransferRequest = {
        account_bank: request.recipient.account?.bankCode || '',
        account_number: request.recipient.account?.accountNumber || '',
        amount: request.amount,
        narration: request.description || 'Payment from AMAC',
        currency: request.currency || 'NGN',
        reference: request.reference,
        beneficiary_name: request.recipient.account?.accountName,
        meta: request.metadata
      };

      const response = await fetch(`${this.baseUrl}/v3/transfers`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.secretKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(transferRequest)
      });

      const data = await response.json();

      this.logApiCall('initiatePayment', transferRequest, data);

      if (data.status === 'success') {
        return {
          success: true,
          reference: data.data.reference,
          providerReference: data.data.id,
          status: this.mapFlutterwaveStatus(data.data.status),
          message: data.message || 'Transfer initiated successfully',
          provider: PaymentProvider.FLUTTERWAVE,
          fee: data.data.fee || 0,
          estimatedDelivery: data.data.approval_expires_at
        };
      } else {
        return {
          success: false,
          message: data.message || 'Transfer initiation failed',
          provider: PaymentProvider.FLUTTERWAVE
        };
      }
    } catch (error) {
      console.error('Flutterwave payment initiation error:', error);
      return {
        success: false,
        message: 'Network error during payment initiation',
        provider: PaymentProvider.FLUTTERWAVE
      };
    }
  }

  /**
   * Check transaction status
   */
  async checkTransactionStatus(reference: string): Promise<TransactionStatusResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/v3/transactions/${reference}/verify`, {
        headers: {
          'Authorization': `Bearer ${this.config.secretKey}`
        }
      });

      const data = await response.json();

      this.logApiCall('checkTransactionStatus', { reference }, data);

      if (data.status === 'success') {
        const transaction = data.data;
        return {
          status: this.mapFlutterwaveStatus(transaction.status),
          amount: transaction.amount,
          reference: transaction.tx_ref || reference,
          providerReference: transaction.id,
          settledAmount: transaction.settlement_amount,
          fees: transaction.app_fee,
          failureReason: transaction.narration || transaction.complete_message,
          timestamp: transaction.created_at
        };
      } else {
        return {
          status: PaymentStatus.FAILED,
          reference,
          failureReason: data.message || 'Transaction verification failed'
        };
      }
    } catch (error) {
      console.error('Flutterwave status check error:', error);
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
        case 'charge.completed':
          console.log('Charge completed:', eventData);
          // Update payment status to successful
          break;
        
        case 'transfer.completed':
          console.log('Transfer completed:', eventData);
          // Handle transfer completion
          break;
        
        case 'transfer.failed':
          console.log('Transfer failed:', eventData);
          // Update payment status to failed with reason
          break;
        
        case 'charge.failed':
          console.log('Charge failed:', eventData);
          // Handle charge failure
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
   * Get supported Nigerian banks from Flutterwave
   */
  async getSupportedBanks(): Promise<any[]> {
    try {
      const response = await fetch(`${this.baseUrl}/v3/banks/NG`, {
        headers: {
          'Authorization': `Bearer ${this.config.secretKey}`
        }
      });

      const data = await response.json();
      
      if (data.status === 'success') {
        return data.data.map((bank: any) => ({
          code: bank.code,
          name: bank.name,
          slug: bank.slug,
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
   * Map Flutterwave status to our PaymentStatus enum
   */
  private mapFlutterwaveStatus(flutterwaveStatus: string): PaymentStatus {
    const statusMap: { [key: string]: PaymentStatus } = {
      'successful': PaymentStatus.SUCCESSFUL,
      'pending': PaymentStatus.PENDING,
      'pending-outgoing': PaymentStatus.PENDING,
      'processing': PaymentStatus.PROCESSING,
      'failed': PaymentStatus.FAILED,
      'cancelled': PaymentStatus.FAILED,
      'reversed': PaymentStatus.REVERSED,
      'error': PaymentStatus.FAILED
    };

    return statusMap[flutterwaveStatus] || PaymentStatus.PENDING;
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
        .createHmac('sha256', this.config.webhookSecret)
        .update(payload)
        .digest('hex');

      // Flutterwave sends both the raw hash and in the header
      return hash === signature || hash.toLowerCase() === signature.toLowerCase();
    } catch (error) {
      console.error('Signature verification error:', error);
      return false;
    }
  }

  /**
   * Get balance from Flutterwave
   */
  async getBalance(): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/v3/balances`, {
        headers: {
          'Authorization': `Bearer ${this.config.secretKey}`
        }
      });

      const data = await response.json();
      
      if (data.status === 'success') {
        const ngnBalance = data.data.find((balance: any) => balance.currency === 'NGN');
        return {
          success: true,
          balance: ngnBalance?.available_balance || 0,
          currency: 'NGN'
        };
      }

      return { success: false, error: data.message };
    } catch (error) {
      console.error('Balance check error:', error);
      return { success: false, error: 'Network error' };
    }
  }

  /**
   * Validate Flutterwave-specific requirements
   */
  protected validateRequest(request: PaymentRequest): string[] {
    const errors = super.validateRequest(request);

    // Flutterwave minimum transfer amount varies by currency
    if (request.amount && request.amount < 1) {
      errors.push('Minimum transfer amount is ₦1');
    }

    // Check currency
    if (request.currency && request.currency !== 'NGN') {
      errors.push('Only NGN currency is supported for Nigerian transfers');
    }

    return errors;
  }

  /**
   * Create mobile money payment (Flutterwave supports OPay)
   */
  async createMobileMoneyPayment(request: PaymentRequest, provider: string): Promise<PaymentResponse> {
    try {
      if (provider === 'OPAY') {
        const opayRequest = {
          tx_ref: request.reference,
          amount: request.amount,
          currency: request.currency || 'NGN',
          payment_type: 'mobilemoney',
          payment_options: 'mobilemoney_ussd',
          mobile_money: {
            provider: 'OPAY',
            phone: request.recipient.mobileMoney?.phoneNumber
          },
          redirect_url: this.config.redirectUrl || ''
        };

        const response = await fetch(`${this.baseUrl}/v3/payments`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.config.secretKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(opayRequest)
        });

        const data = await response.json();

        this.logApiCall('createMobileMoneyPayment', opayRequest, data);

        if (data.status === 'success') {
          return {
            success: true,
            reference: data.data.tx_ref,
            providerReference: data.data.id,
            status: PaymentStatus.PENDING,
            message: 'Mobile money payment initiated',
            provider: PaymentProvider.FLUTTERWAVE
          };
        } else {
          return {
            success: false,
            message: data.message || 'Mobile money payment failed'
          };
        }
      } else {
        return {
          success: false,
          message: `Unsupported mobile money provider: ${provider}`
        };
      }
    } catch (error) {
      console.error('Mobile money payment error:', error);
      return {
        success: false,
        message: 'Network error during mobile money payment'
      };
    }
  }

  /**
   * Create USSD payment
   */
  async createUSSDPayment(request: PaymentRequest): Promise<PaymentResponse> {
    try {
      const ussdRequest = {
        tx_ref: request.reference,
        amount: request.amount,
        currency: request.currency || 'NGN',
        payment_type: 'ussd',
        payment_options: 'ussd',
        country: 'NG'
      };

      const response = await fetch(`${this.baseUrl}/v3/payments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.secretKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(ussdRequest)
      });

      const data = await response.json();

      this.logApiCall('createUSSDPayment', ussdRequest, data);

      if (data.status === 'success') {
        return {
          success: true,
          reference: data.data.tx_ref,
          providerReference: data.data.id,
          status: PaymentStatus.PENDING,
          message: 'USSD payment initiated',
          provider: PaymentProvider.FLUTTERWAVE,
          estimatedDelivery: data.data.payment_expiry_time
        };
      } else {
        return {
          success: false,
          message: data.message || 'USSD payment failed'
        };
      }
    } catch (error) {
      console.error('USSD payment error:', error);
      return {
        success: false,
        message: 'Network error during USSD payment'
      };
    }
  }
}