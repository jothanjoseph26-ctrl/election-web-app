/**
 * Payment Provider Factory and Manager
 * Handles switching between different Nigerian payment providers
 */

import { BasePaymentProvider } from './base';
import { PaystackProvider, type PaystackConfig } from './paystack';
import { FlutterwaveProvider, type FlutterwaveConfig } from './flutterwave';
import { PaymentProvider, PaymentRequest, PaymentResponse, AccountVerificationRequest, AccountVerificationResponse, TransactionStatusResponse, type WebhookEvent } from './base';

export interface PaymentProviderConfig {
  primaryProvider: PaymentProvider;
  fallbackProviders: PaymentProvider[];
  providers: {
    paystack?: PaystackConfig;
    flutterwave?: FlutterwaveConfig;
    interswitch?: any; // Can be added later
  };
  autoFallback: boolean;
  retryAttempts: number;
}

export interface PaymentTransaction {
  id: string;
  amount: number;
  currency: string;
  reference: string;
  provider: PaymentProvider;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  recipient: any;
  metadata?: any;
  attempts: Array<{
    provider: PaymentProvider;
    status: string;
    timestamp: Date;
    error?: string;
  }>;
}

/**
 * Payment Provider Factory
 */
export class PaymentProviderFactory {
  private static providers: Map<PaymentProvider, BasePaymentProvider> = new Map();
  private static config: PaymentProviderConfig;

  static initialize(config: PaymentProviderConfig): void {
    this.config = config;

    // Initialize primary provider
    if (config.providers.paystack && config.primaryProvider === PaymentProvider.PAYSTACK) {
      this.providers.set(PaymentProvider.PAYSTACK, new PaystackProvider(config.providers.paystack));
    }

    if (config.providers.flutterwave && config.primaryProvider === PaymentProvider.FLUTTERWAVE) {
      this.providers.set(PaymentProvider.FLUTTERWAVE, new FlutterwaveProvider(config.providers.flutterwave));
    }

    // Initialize fallback providers
    config.fallbackProviders.forEach(provider => {
      if (config.providers.paystack && provider === PaymentProvider.PAYSTACK) {
        this.providers.set(PaymentProvider.PAYSTACK, new PaystackProvider(config.providers.paystack));
      }

      if (config.providers.flutterwave && provider === PaymentProvider.FLUTTERWAVE) {
        this.providers.set(PaymentProvider.FLUTTERWAVE, new FlutterwaveProvider(config.providers.flutterwave));
      }
    });
  }

  static getProvider(provider: PaymentProvider): BasePaymentProvider | undefined {
    return this.providers.get(provider);
  }

  static getPrimaryProvider(): BasePaymentProvider | undefined {
    return this.providers.get(this.config.primaryProvider);
  }

  static getAllProviders(): BasePaymentProvider[] {
    return Array.from(this.providers.values());
  }

  static isConfigured(): boolean {
    return this.providers.size > 0;
  }
}

/**
 * Payment Manager - orchestrates payments across multiple providers
 */
export class PaymentManager {
  private config: PaymentProviderConfig;
  private transactions: Map<string, PaymentTransaction> = new Map();

  constructor(config: PaymentProviderConfig) {
    this.config = config;
    PaymentProviderFactory.initialize(config);
  }

  /**
   * Process payment with automatic fallback
   */
  async processPayment(request: PaymentRequest): Promise<PaymentResponse> {
    const transactionId = this.generateTransactionId();
    const transaction: PaymentTransaction = {
      id: transactionId,
      amount: request.amount,
      currency: request.currency,
      reference: request.reference,
      provider: this.config.primaryProvider,
      status: 'processing',
      createdAt: new Date(),
      updatedAt: new Date(),
      recipient: request.recipient,
      metadata: request.metadata,
      attempts: []
    };

    this.transactions.set(transactionId, transaction);

    // Try primary provider first
    const primaryProvider = PaymentProviderFactory.getPrimaryProvider();
    if (!primaryProvider) {
      return {
        success: false,
        message: 'No payment provider configured'
      };
    }

    try {
      const attempt = await this.attemptPayment(primaryProvider, request);
      transaction.attempts.push(attempt);

      if (attempt.success) {
        transaction.provider = primaryProvider.getProvider();
        transaction.status = 'success';
        transaction.updatedAt = new Date();
        
        return {
          success: true,
          reference: attempt.reference,
          providerReference: attempt.providerReference,
          status: attempt.status,
          message: `Payment processed via ${primaryProvider.getProvider()}`,
          provider: primaryProvider.getProvider(),
          fee: attempt.fee
        };
      }
    } catch (error) {
      console.error(`Primary provider ${primaryProvider.getProvider()} failed:`, error);
      
      const failedAttempt = {
        provider: primaryProvider.getProvider(),
        status: 'failed',
        timestamp: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      transaction.attempts.push(failedAttempt);
    }

    // Try fallback providers if enabled
    if (this.config.autoFallback && this.config.fallbackProviders.length > 0) {
      for (const fallbackProviderType of this.config.fallbackProviders) {
        const fallbackProvider = PaymentProviderFactory.getProvider(fallbackProviderType);
        
        if (!fallbackProvider) {
          console.warn(`Fallback provider ${fallbackProviderType} not configured`);
          continue;
        }

        try {
          const attempt = await this.attemptPayment(fallbackProvider, request);
          transaction.attempts.push(attempt);

          if (attempt.success) {
            transaction.provider = fallbackProviderType;
            transaction.status = 'success';
            transaction.updatedAt = new Date();
            
            return {
              success: true,
              reference: attempt.reference,
              providerReference: attempt.providerReference,
              status: attempt.status,
              message: `Payment processed via fallback ${fallbackProviderType}`,
              provider: fallbackProviderType,
              fee: attempt.fee
            };
          }
        } catch (error) {
          console.error(`Fallback provider ${fallbackProviderType} failed:`, error);
          
          const failedAttempt = {
            provider: fallbackProviderType,
            status: 'failed',
            timestamp: new Date(),
            error: error instanceof Error ? error.message : 'Unknown error'
          };
          transaction.attempts.push(failedAttempt);
        }
      }
    }

    // All providers failed
    transaction.status = 'failed';
    transaction.updatedAt = new Date();

    return {
      success: false,
      message: 'All payment providers failed',
      provider: this.config.primaryProvider
    };
  }

  /**
   * Verify account using available providers
   */
  async verifyAccount(request: AccountVerificationRequest): Promise<AccountVerificationResponse> {
    const primaryProvider = PaymentProviderFactory.getPrimaryProvider();
    
    if (!primaryProvider) {
      return {
        isValid: false,
        errorMessage: 'No payment provider configured'
      };
    }

    try {
      return await primaryProvider.verifyAccount(request);
    } catch (error) {
      console.error('Primary account verification failed:', error);
      
      // Try fallback providers
      for (const fallbackProviderType of this.config.fallbackProviders) {
        const fallbackProvider = PaymentProviderFactory.getProvider(fallbackProviderType);
        
        if (!fallbackProvider) continue;

        try {
          return await fallbackProvider.verifyAccount(request);
        } catch (fallbackError) {
          console.error(`Fallback account verification failed:`, fallbackError);
        }
      }
    }

    return {
      isValid: false,
      errorMessage: 'Account verification failed on all providers'
    };
  }

  /**
   * Check transaction status across providers
   */
  async checkTransactionStatus(reference: string, providerType?: PaymentProvider): Promise<TransactionStatusResponse> {
    const targetProvider = providerType 
      ? PaymentProviderFactory.getProvider(providerType)
      : PaymentProviderFactory.getPrimaryProvider();

    if (!targetProvider) {
      return {
        status: 'failed' as any,
        reference,
        failureReason: 'Provider not found'
      };
    }

    try {
      return await targetProvider.checkTransactionStatus(reference);
    } catch (error) {
      console.error('Status check failed:', error);
      return {
        status: 'failed' as any,
        reference,
        failureReason: 'Status check failed'
      };
    }
  }

  /**
   * Process webhook from any provider
   */
  async processWebhook(providerType: PaymentProvider, signature: string, payload: any): Promise<boolean> {
    const provider = PaymentProviderFactory.getProvider(providerType);
    
    if (!provider) {
      console.error(`Webhook received from unknown provider: ${providerType}`);
      return false;
    }

    try {
      return await provider.processWebhook({
        event: payload.event,
        data: payload.data,
        provider: providerType,
        signature
      });
    } catch (error) {
      console.error(`Webhook processing failed for ${providerType}:`, error);
      return false;
    }
  }

  /**
   * Get supported banks from all providers
   */
  async getSupportedBanks(): Promise<any[]> {
    const primaryProvider = PaymentProviderFactory.getPrimaryProvider();
    
    if (primaryProvider) {
      try {
        return await primaryProvider.getSupportedBanks();
      } catch (error) {
        console.error('Failed to fetch banks from primary provider:', error);
      }
    }

    return [];
  }

  /**
   * Get provider health status
   */
  async getProviderHealth(): Promise<Map<PaymentProvider, boolean>> {
    const healthStatus = new Map<PaymentProvider, boolean>();
    const providers = PaymentProviderFactory.getAllProviders();

    for (const provider of providers) {
      try {
        // Simple health check by trying to fetch banks
        await provider.getSupportedBanks();
        healthStatus.set(provider.getProvider(), true);
      } catch (error) {
        console.error(`Provider ${provider.getProvider()} health check failed:`, error);
        healthStatus.set(provider.getProvider(), false);
      }
    }

    return healthStatus;
  }

  /**
   * Get transaction history
   */
  getTransactions(): PaymentTransaction[] {
    return Array.from(this.transactions.values());
  }

  /**
   * Get specific transaction
   */
  getTransaction(id: string): PaymentTransaction | undefined {
    return this.transactions.get(id);
  }

  /**
   * Get transaction by reference
   */
  getTransactionByReference(reference: string): PaymentTransaction | undefined {
    return Array.from(this.transactions.values())
      .find(transaction => transaction.reference === reference);
  }

  /**
   * Attempt payment with specific provider
   */
  private async attemptPayment(provider: BasePaymentProvider, request: PaymentRequest): Promise<PaymentResponse> {
    try {
      return await provider.initiatePayment(request);
    } catch (error) {
      console.error(`Payment attempt failed with ${provider.getProvider()}:`, error);
      
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Payment attempt failed',
        provider: provider.getProvider()
      };
    }
  }

  /**
   * Generate unique transaction ID
   */
  private generateTransactionId(): string {
    return `txn_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  /**
   * Get payment statistics
   */
  getStatistics(): {
    totalTransactions: number;
    successfulTransactions: number;
    failedTransactions: number;
    totalAmount: number;
    providerStats: Map<PaymentProvider, { attempts: number; successes: number; failures: number }>;
  } {
    const transactions = this.getTransactions();
    const totalTransactions = transactions.length;
    const successfulTransactions = transactions.filter(t => t.status === 'success').length;
    const failedTransactions = transactions.filter(t => t.status === 'failed').length;
    const totalAmount = transactions
      .filter(t => t.status === 'success')
      .reduce((sum, t) => sum + t.amount, 0);

    const providerStats = new Map<PaymentProvider, { attempts: number; successes: number; failures: number }>();

    transactions.forEach(transaction => {
      const current = providerStats.get(transaction.provider) || { attempts: 0, successes: 0, failures: 0 };
      current.attempts++;
      
      if (transaction.status === 'success') {
        current.successes++;
      } else if (transaction.status === 'failed') {
        current.failures++;
      }
      
      providerStats.set(transaction.provider, current);
    });

    return {
      totalTransactions,
      successfulTransactions,
      failedTransactions,
      totalAmount,
      providerStats
    };
  }
}