/**
 * Nigerian Payment Compliance Module
 * Handles CBN regulations, AML checks, and compliance reporting
 */

export interface ComplianceCheck {
  isValid: boolean;
  violations: string[];
  riskLevel: 'low' | 'medium' | 'high';
  warnings: string[];
}

export interface TransactionLimits {
  dailyLimit: number;
  monthlyLimit: number;
  singleTransactionLimit: number;
  currency: string;
}

export interface KYCDocument {
  type: 'bvn' | 'id_card' | 'utility_bill' | 'passport';
  number: string;
  verified: boolean;
  verificationDate?: string;
  expiryDate?: string;
}

export interface ComplianceReport {
  transactionId: string;
  agentId: string;
  amount: number;
  timestamp: Date;
  complianceChecks: {
    amlCheck: boolean;
    bvnVerified: boolean;
    transactionWithinLimits: boolean;
    blacklisted: boolean;
  };
  riskScore: number;
  requiresManualReview: boolean;
  reviewReason?: string;
}

/**
 * Nigerian Regulatory Compliance Class
 */
export class NigerianCompliance {
  private static readonly TRANSACTION_LIMITS: Record<string, TransactionLimits> = {
    bank_transfer: {
      dailyLimit: 5000000, // ₦5M daily for individuals
      monthlyLimit: 20000000, // ₦20M monthly for individuals
      singleTransactionLimit: 10000000, // ₦10M per transaction
      currency: 'NGN'
    },
    mobile_money: {
      dailyLimit: 100000, // ₦100K daily for mobile money
      monthlyLimit: 1000000, // ₦1M monthly for mobile money
      singleTransactionLimit: 50000, // ₦50K per mobile money transaction
      currency: 'NGN'
    },
    ussd: {
      dailyLimit: 200000, // ₦200K daily for USSD
      monthlyLimit: 2000000, // ₦2M monthly for USSD
      singleTransactionLimit: 100000, // ₦100K per USSD transaction
      currency: 'NGN'
    }
  };

  private static readonly BLACKLISTED_NAMES = [
    'TERRORIST',
    'TERRORISM',
    'BOMB',
    'EXPLOSIVE',
    'DRUGS',
    'NARCOTICS',
    'MONEY LAUNDERING'
  ];

  private static readonly HIGH_RISK_COUNTRIES = [
    'AF', 'IR', 'KP', 'MM', 'SY', 'YE', 'SO', 'SS', 'SD'
  ];

  /**
   * Validate transaction for Nigerian compliance
   */
  static validateTransaction(
    amount: number,
    paymentMethod: string,
    agentInfo: {
      id: string;
      name: string;
      bvn?: string;
      email?: string;
      phone?: string;
      transactionHistory?: Array<{ amount: number; timestamp: Date; }>;
    }
  ): ComplianceCheck {
    const violations: string[] = [];
    const warnings: string[] = [];
    let riskLevel: 'low' | 'medium' | 'high' = 'low';

    // Check transaction limits
    const limits = this.TRANSACTION_LIMITS[paymentMethod] || this.TRANSACTION_LIMITS.bank_transfer;
    
    if (amount > limits.singleTransactionLimit) {
      violations.push(`Amount ₦${amount.toLocaleString()} exceeds single transaction limit of ₦${limits.singleTransactionLimit.toLocaleString()}`);
      riskLevel = 'high';
    }

    // Check daily limits (if transaction history available)
    if (agentInfo.transactionHistory) {
      const today = new Date();
      const todayTransactions = agentInfo.transactionHistory.filter(
        t => t.timestamp.toDateString() === today.toDateString()
      );
      const dailyTotal = todayTransactions.reduce((sum, t) => sum + t.amount, 0) + amount;

      if (dailyTotal > limits.dailyLimit) {
        violations.push(`Daily total ₦${dailyTotal.toLocaleString()} exceeds daily limit of ₦${limits.dailyLimit.toLocaleString()}`);
        riskLevel = 'high';
      }

      // Check monthly limits
      const thisMonth = new Date();
      const monthlyTransactions = agentInfo.transactionHistory.filter(
        t => t.timestamp.getMonth() === thisMonth.getMonth() && 
             t.timestamp.getFullYear() === thisMonth.getFullYear()
      );
      const monthlyTotal = monthlyTransactions.reduce((sum, t) => sum + t.amount, 0) + amount;

      if (monthlyTotal > limits.monthlyLimit) {
        violations.push(`Monthly total ₦${monthlyTotal.toLocaleString()} exceeds monthly limit of ₦${limits.monthlyLimit.toLocaleString()}`);
        riskLevel = 'high';
      }
    }

    // AML checks - name screening
    if (this.screenName(agentInfo.name, violations)) {
      riskLevel = 'high';
    }

    // Amount pattern analysis
    if (this.isSuspiciousAmount(amount)) {
      warnings.push('Transaction amount follows suspicious pattern');
      if (riskLevel !== 'high') riskLevel = 'medium';
    }

    // Time pattern checks
    const currentHour = new Date().getHours();
    if (currentHour >= 22 || currentHour <= 5) {
      if (amount > 100000) { // Large amount during unusual hours
        warnings.push('Large transaction during unusual hours');
        if (riskLevel === 'low') riskLevel = 'medium';
      }
    }

    // Frequency checks
    if (agentInfo.transactionHistory) {
      const recentTransactions = agentInfo.transactionHistory.filter(
        t => (Date.now() - t.timestamp.getTime()) < (24 * 60 * 60 * 1000) // Last 24 hours
      );
      
      if (recentTransactions.length > 10) {
        warnings.push('High frequency of transactions detected');
        if (riskLevel === 'low') riskLevel = 'medium';
      }
    }

    return {
      isValid: violations.length === 0,
      violations,
      riskLevel,
      warnings
    };
  }

  /**
   * Validate BVN (Bank Verification Number)
   */
  static validateBVN(bvn: string): { isValid: boolean; error?: string } {
    if (!bvn) {
      return { isValid: false, error: 'BVN is required for transactions above ₦100,000' };
    }

    // Remove any non-digit characters
    const cleanBVN = bvn.replace(/\D/g, '');

    if (cleanBVN.length !== 11) {
      return { isValid: false, error: 'BVN must be exactly 11 digits' };
    }

    // Check if all digits are the same
    if (/^(\d)\1{10}$/.test(cleanBVN)) {
      return { isValid: false, error: 'Invalid BVN format' };
    }

    // Additional checksum validation (simplified)
    const checksum = cleanBVN.split('').reduce((sum, digit, index) => {
      return sum + (parseInt(digit) * (11 - index));
    }, 0);

    if (checksum % 11 !== 0) {
      return { isValid: false, error: 'Invalid BVN checksum' };
    }

    return { isValid: true };
  }

  /**
   * Check if name contains blacklisted terms
   */
  private static screenName(name: string, violations: string[]): boolean {
    const upperName = name.toUpperCase();
    let hasViolation = false;

    for (const blacklistedTerm of this.BLACKLISTED_NAMES) {
      if (upperName.includes(blacklistedTerm)) {
        violations.push(`Name contains prohibited term: ${blacklistedTerm}`);
        hasViolation = true;
      }
    }

    return hasViolation;
  }

  /**
   * Check if amount follows suspicious patterns
   */
  private static isSuspiciousAmount(amount: number): boolean {
    // Round amounts ending in repeating 9s (common in structuring)
    if (/9999$/.test(amount.toString())) {
      return true;
    }

    // Amounts that are just below reporting thresholds
    const suspiciousThresholds = [
      999999, 9999999, 99999999, // Just below 1M, 10M, 100M
      999900, 9999900, 99999000  // Just below round millions
    ];

    return suspiciousThresholds.includes(amount);
  }

  /**
   * Generate compliance report for transaction
   */
  static generateComplianceReport(
    transactionId: string,
    agentId: string,
    amount: number,
    paymentMethod: string,
    agentInfo: any
  ): ComplianceReport {
    const complianceCheck = this.validateTransaction(amount, paymentMethod, agentInfo);
    
    let riskScore = 0;
    if (complianceCheck.riskLevel === 'high') riskScore = 75;
    else if (complianceCheck.riskLevel === 'medium') riskScore = 45;
    else riskScore = 15;

    // Add risk for high amounts
    if (amount > 1000000) riskScore += 20;
    else if (amount > 500000) riskScore += 10;

    // Add risk for lack of BVN
    if (!agentInfo.bvn && amount > 100000) riskScore += 25;

    // Determine if manual review is needed
    const requiresManualReview = 
      complianceCheck.violations.length > 0 ||
      riskScore > 50 ||
      amount > 5000000; // Any transaction over ₦5M

    const reviewReason = requiresManualReview ? 
      (complianceCheck.violations.length > 0 
        ? complianceCheck.violations.join(', ')
        : `High risk score: ${riskScore}`) 
      : undefined;

    return {
      transactionId,
      agentId,
      amount,
      timestamp: new Date(),
      complianceChecks: {
        amlCheck: !this.screenName(agentInfo.name, []),
        bvnVerified: !!agentInfo.bvn,
        transactionWithinLimits: complianceCheck.isValid,
        blacklisted: false // Would check against actual blacklist
      },
      riskScore,
      requiresManualReview,
      reviewReason
    };
  }

  /**
   * Get transaction limits for payment method
   */
  static getTransactionLimits(paymentMethod: string): TransactionLimits {
    return this.TRANSACTION_LIMITS[paymentMethod] || this.TRANSACTION_LIMITS.bank_transfer;
  }

  /**
   * Check if transaction requires KYC
   */
  static requiresKYC(amount: number, paymentMethod: string): boolean {
    // KYC required for transactions above certain thresholds
    const kycThresholds = {
      bank_transfer: 1000000, // ₦1M
      mobile_money: 100000, // ₦100K
      ussd: 50000 // ₦50K
    };

    return amount > (kycThresholds[paymentMethod] || kycThresholds.bank_transfer);
  }

  /**
   * Generate audit trail for compliance
   */
  static generateAuditTrail(
    action: string,
    agentId: string,
    details: any,
    timestamp: Date = new Date()
  ): any {
    return {
      timestamp: timestamp.toISOString(),
      action,
      agentId,
      details,
      complianceLevel: this.getComplianceLevel(details),
      ipAddress: details.ipAddress || 'unknown',
      userAgent: details.userAgent || 'unknown',
      location: details.location || 'unknown'
    };
  }

  /**
   * Determine compliance level for audit
   */
  private static getComplianceLevel(details: any): 'low' | 'medium' | 'high' {
    if (details.amount > 5000000) return 'high';
    if (details.amount > 1000000) return 'medium';
    return 'low';
  }

  /**
   * Format compliance warning message
   */
  static formatComplianceMessage(check: ComplianceCheck): string {
    if (check.isValid) {
      return `Transaction approved. Risk level: ${check.riskLevel}`;
    }

    const violations = check.violations.join('; ');
    const warnings = check.warnings.length > 0 
      ? ` Warnings: ${check.warnings.join('; ')}`
      : '';

    return `Transaction rejected. Risk level: ${check.riskLevel}. Violations: ${violations}${warnings}`;
  }

  /**
   * CBN-required data retention period (in years)
   */
  static getRequiredRetentionPeriod(transactionType: string): number {
    const retentionPeriods = {
      bank_transfer: 7, // 7 years for bank transfers
      mobile_money: 5, // 5 years for mobile money
      ussd: 3, // 3 years for USSD
      default: 7
    };

    return retentionPeriods[transactionType] || retentionPeriods.default;
  }

  /**
   * Check if transaction is exempt from certain regulations
   */
  static isExemptTransaction(amount: number, recipientType: string): boolean {
    // Government transactions may be exempt
    if (recipientType === 'government_entity') {
      return true;
    }

    // Microtransactions below certain threshold
    if (amount < 1000) { // Below ₦1,000
      return true;
    }

    return false;
  }

  /**
   * Generate regulatory reporting data
   */
  static generateRegulatoryReport(
    transactions: Array<{
      id: string;
      amount: number;
      timestamp: Date;
      paymentMethod: string;
      agentId: string;
      agentName: string;
    }>,
    reportType: 'daily' | 'monthly' | 'quarterly'
  ): any {
    const totalAmount = transactions.reduce((sum, t) => sum + t.amount, 0);
    const suspiciousTransactions = transactions.filter(t => 
      t.amount > 1000000 || // Large transactions
      new Date(t.timestamp).getHours() >= 22 || new Date(t.timestamp).getHours() <= 5 // Unusual hours
    );

    return {
      reportType,
      period: new Date().toISOString(),
      totalTransactions: transactions.length,
      totalAmount,
      averageTransactionAmount: totalAmount / transactions.length,
      suspiciousTransactions: suspiciousTransactions.length,
      suspiciousTransactionsAmount: suspiciousTransactions.reduce((sum, t) => sum + t.amount, 0),
      highValueTransactions: transactions.filter(t => t.amount > 1000000).length,
      paymentMethodBreakdown: this.getPaymentMethodBreakdown(transactions),
      complianceScore: this.calculateComplianceScore(transactions),
      generatedAt: new Date().toISOString(),
      generatedBy: 'AMAC Payment System'
    };
  }

  /**
   * Get breakdown of transactions by payment method
   */
  private static getPaymentMethodBreakdown(transactions: any[]): any {
    return transactions.reduce((breakdown, transaction) => {
      const method = transaction.paymentMethod;
      if (!breakdown[method]) {
        breakdown[method] = { count: 0, amount: 0 };
      }
      breakdown[method].count++;
      breakdown[method].amount += transaction.amount;
      return breakdown;
    }, {});
  }

  /**
   * Calculate overall compliance score for a set of transactions
   */
  private static calculateComplianceScore(transactions: any[]): number {
    let score = 100;
    
    transactions.forEach(transaction => {
      // Deduct points for suspicious transactions
      if (this.isSuspiciousAmount(transaction.amount)) {
        score -= 5;
      }
      
      // Deduct for unusual timing
      const hour = new Date(transaction.timestamp).getHours();
      if (hour >= 22 || hour <= 5) {
        score -= 2;
      }
    });

    return Math.max(0, Math.min(100, score));
  }
}