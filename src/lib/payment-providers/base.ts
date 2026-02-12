/**
 * Payment Provider Abstraction Layer
 * Supports multiple Nigerian payment providers (Paystack, Flutterwave, etc.)
 */

export enum PaymentProvider {
  PAYSTACK = 'paystack',
  FLUTTERWAVE = 'flutterwave',
  INTERSWITCH = 'interswitch'
}

export enum PaymentMethod {
  BANK_TRANSFER = 'bank_transfer',
  MOBILE_MONEY = 'mobile_money',
  USSD = 'ussd',
  CARD = 'card',
  CASH = 'cash',
  CHEQUE = 'cheque'
}

export enum PaymentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing', 
  SUCCESSFUL = 'successful',
  FAILED = 'failed',
  REVERSED = 'reversed'
}

export interface BankAccount {
  accountNumber: string;
  accountName: string;
  bankCode: string;
  bankName: string;
}

export interface MobileMoneyAccount {
  phoneNumber: string;
  provider: string;
  providerName: string;
  accountName?: string;
}

export interface Recipient {
  type: 'bank_account' | 'mobile_money' | 'ussd';
  account?: BankAccount;
  mobileMoney?: MobileMoneyAccount;
}

export interface PaymentRequest {
  amount: number;
  currency: string; // NGN
  reference: string;
  recipient: Recipient;
  description?: string;
  metadata?: Record<string, any>;
}

export interface PaymentResponse {
  success: boolean;
  reference?: string;
  providerReference?: string;
  status?: PaymentStatus;
  message?: string;
  provider?: PaymentProvider;
  fee?: number;
  estimatedDelivery?: string;
  requiresApproval?: boolean;
}

export interface AccountVerificationRequest {
  accountNumber: string;
  bankCode: string;
}

export interface AccountVerificationResponse {
  isValid: boolean;
  accountName?: string;
  bankName?: string;
  errorMessage?: string;
}

export interface TransactionStatusResponse {
  status: PaymentStatus;
  amount?: number;
  reference?: string;
  providerReference?: string;
  fees?: number;
  settledAmount?: number;
  failureReason?: string;
  timestamp?: string;
}

export interface WebhookEvent {
  event: string;
  data: any;
  provider: PaymentProvider;
  signature: string;
}

/**
 * Abstract Payment Provider Interface
 */
export abstract class BasePaymentProvider {
  protected provider: PaymentProvider;
  protected apiKey: string;
  protected config: any;

  constructor(provider: PaymentProvider, apiKey: string, config?: any) {
    this.provider = provider;
    this.apiKey = apiKey;
    this.config = config || {};
  }

  /**
   * Verify bank account details
   */
  abstract verifyAccount(request: AccountVerificationRequest): Promise<AccountVerificationResponse>;

  /**
   * Initiate a payment/transfer
   */
  abstract initiatePayment(request: PaymentRequest): Promise<PaymentResponse>;

  /**
   * Check transaction status
   */
  abstract checkTransactionStatus(reference: string): Promise<TransactionStatusResponse>;

  /**
   * Process webhook events
   */
  abstract processWebhook(event: WebhookEvent): Promise<boolean>;

  /**
   * Get supported banks
   */
  abstract getSupportedBanks(): Promise<any[]>;

  /**
   * Get provider name
   */
  getProvider(): PaymentProvider {
    return this.provider;
  }

  /**
   * Validate request before sending
   */
  protected validateRequest(request: PaymentRequest): string[] {
    const errors: string[] = [];

    if (!request.amount || request.amount <= 0) {
      errors.push('Valid amount is required');
    }

    if (!request.reference) {
      errors.push('Reference is required');
    }

    if (!request.recipient) {
      errors.push('Recipient information is required');
    }

    return errors;
  }

  /**
   * Generate provider-specific reference
   */
  protected generateProviderReference(prefix: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `${prefix}${timestamp}${random}`;
  }

  /**
   * Log API calls for debugging
   */
  protected logApiCall(method: string, data: any, response?: any): void {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[${this.provider}] ${method}:`, {
        request: data,
        response: response
      });
    }
  }
}