# Nigerian Payment System Integration Guide

## Overview

This comprehensive payment system integrates Nigerian payment providers with the AMAC situation room, replacing the mock payment system with real payment processing capabilities compliant with Central Bank of Nigeria (CBN) regulations.

## Architecture

### Payment Provider Abstraction Layer

The system uses an abstraction layer that supports multiple payment providers:
- **Paystack** (Primary Provider)
- **Flutterwave** (Fallback Provider)
- **Interswitch** (Future Support)

### Core Components

1. **BasePaymentProvider** (`src/lib/payment-providers/base.ts`)
   - Abstract base class defining payment provider interface
   - Common methods for all providers

2. **Provider Implementations**
   - `PaystackProvider` (`src/lib/payment-providers/paystack.ts`)
   - `FlutterwaveProvider` (`src/lib/payment-providers/flutterwave.ts`)

3. **PaymentManager** (`src/lib/payment-providers/manager.ts`)
   - Orchestrates payments across multiple providers
   - Handles automatic failover between providers
   - Maintains transaction history and statistics

4. **Nigerian Utilities** (`src/lib/nigerian-payments.ts`)
   - NUBAN (Nigerian Uniform Bank Account Number) validation
   - Bank codes and USSD codes for all 24 Nigerian banks
   - Mobile money provider support
   - Phone number validation

5. **Compliance Module** (`src/lib/nigerian-compliance.ts`)
   - CBN regulatory compliance
   - AML (Anti-Money Laundering) checks
   - Transaction limit enforcement
   - BVN validation

## Supported Payment Methods

### 1. Bank Transfers
- **All 24 Nigerian banks supported**
- Real-time account number verification
- NUBAN format validation (10-digit account numbers)
- Automatic name verification

### 2. Mobile Money
- **Paga** (*242#)
- **OPay** (*955#)
- **MTN MoMo** (*310#)
- **AirtelTigo Money** (*110#)
- **Glo Cash** (*500#)

### 3. USSD Payments
- Bank-specific USSD codes (e.g., *737# for GTB)
- Unbanked agent support
- No internet required

### 4. Card Payments
- Local and international cards
- 3D Secure support
- CVV verification

## Configuration

### Environment Variables

```bash
# Primary Provider Configuration
NEXT_PUBLIC_PRIMARY_PAYMENT_PROVIDER=paystack

# Paystack Configuration
PAYSTACK_SECRET_KEY=sk_live_...
PAYSTACK_PUBLIC_KEY=pk_live_...
PAYSTACK_WEBHOOK_SECRET=whsec_...

# Flutterwave Configuration  
FLUTTERWAVE_SECRET_KEY=FLWSECK-...
FLUTTERWAVE_PUBLIC_KEY=FLWPUBK-...
FLUTTERWAVE_ENCRYPTION_KEY=FLWSECK-...
FLUTTERWAVE_WEBHOOK_SECRET=...

# Environment (sandbox/live)
PAYSTACK_BASE_URL=https://api.paystack.co
FLUTTERWAVE_BASE_URL=https://api.flutterwave.com
```

## API Integration Examples

### Verify Bank Account

```typescript
import { PaymentService } from '@/services/payment.service';

const verification = await PaymentService.verifyNigerianBankAccount(
  '0123456789',
  '044' // Access Bank code
);

if (verification.isValid) {
  console.log('Account verified:', verification.accountName);
} else {
  console.log('Verification failed:', verification.error);
}
```

### Process Bank Transfer Payment

```typescript
const result = await PaymentService.processPaymentWithProvider(
  paymentRecord,
  PaymentProvider.PAYSTACK
);

if (result.success) {
  console.log('Payment sent:', result.transactionId);
} else {
  console.log('Payment failed:', result.error);
}
```

### Process Mobile Money Payment

```typescript
const result = await PaymentService.processMobileMoneyPayment(
  paymentRecord,
  'OPAY',
  '+2348012345678'
);
```

### Process USSD Payment

```typescript
const result = await PaymentService.processUSSDPayment(paymentRecord);
```

## Compliance Features

### Transaction Limits

| Payment Method | Daily Limit | Monthly Limit | Single Transaction |
|---------------|-------------|--------------|-------------------|
| Bank Transfer | ₦5,000,000 | ₦20,000,000 | ₦10,000,000 |
| Mobile Money | ₦100,000 | ₦1,000,000 | ₦50,000 |
| USSD | ₦200,000 | ₦2,000,000 | ₦100,000 |

### AML Checks

- Name screening against blacklisted terms
- Suspicious amount pattern detection
- Unusual transaction timing analysis
- High-frequency transaction monitoring
- Country risk assessment

### BVN Validation

```typescript
import { NigerianCompliance } from '@/lib/nigerian-compliance';

const bvnValidation = NigerianCompliance.validateBVN('12345678901');

if (bvnValidation.isValid) {
  console.log('BVN is valid');
}
```

## Webhook Integration

### Paystack Webhook

```typescript
// API route: /api/webhooks/paystack
export async function POST(req: Request) {
  const signature = req.headers.get('x-paystack-signature');
  const payload = await req.json();
  
  await PaymentService.handlePaymentWebhook(
    PaymentProvider.PAYSTACK,
    signature,
    payload
  );
  
  return Response.json({ received: true });
}
```

### Flutterwave Webhook

```typescript
// API route: /api/webhooks/flutterwave
export async function POST(req: Request) {
  const signature = req.headers.get('verif-hash');
  const payload = await req.json();
  
  await PaymentService.handlePaymentWebhook(
    PaymentProvider.FLUTTERWAVE,
    signature,
    payload
  );
  
  return Response.json({ received: true });
}
```

## Database Schema Updates

### Payment Records Enhancement

```sql
-- Enhanced payment_records table for Nigerian payments
ALTER TABLE payment_records ADD COLUMN transaction_id TEXT;
ALTER TABLE payment_records ADD COLUMN provider TEXT;
ALTER TABLE payment_records ADD COLUMN provider_reference TEXT;
ALTER TABLE payment_records ADD COLUMN compliance_check JSONB;
ALTER TABLE payment_records ADD COLUMN risk_score INTEGER;
ALTER TABLE payment_records ADD COLUMN requires_review BOOLEAN DEFAULT FALSE;

-- Indexes for performance
CREATE INDEX idx_payment_records_provider ON payment_records(provider);
CREATE INDEX idx_payment_records_compliance ON payment_records(requires_review);
```

### Compliance Tracking

```sql
-- Compliance reports table
CREATE TABLE compliance_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID REFERENCES payment_records(id),
  agent_id UUID REFERENCES agents(id),
  amount DECIMAL(10,2) NOT NULL,
  compliance_checks JSONB NOT NULL,
  risk_score INTEGER NOT NULL,
  requires_manual_review BOOLEAN DEFAULT FALSE,
  review_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Error Handling

### Provider Failover

The system automatically switches to fallback providers when the primary provider fails:

1. **Primary Provider Attempt** (Paystack)
2. **Fallback Provider Attempt** (Flutterwave)
3. **Final Error** if all fail

### Retry Logic

- Up to 3 retry attempts for failed payments
- Exponential backoff between retries
- Detailed logging of all attempts

## Security Features

### Signature Verification

All webhooks are verified using provider-specific signatures:
- Paystack: HMAC SHA512
- Flutterwave: HMAC SHA256

### Data Encryption

- Sensitive data encrypted in transit
- API keys stored securely
- PII data masking in logs

### Rate Limiting

- IP-based rate limiting
- Transaction frequency monitoring
- Automatic suspension of suspicious accounts

## Testing

### Sandbox Environment

```typescript
// Configure for testing
const config = {
  providers: {
    paystack: {
      secretKey: process.env.PAYSTACK_TEST_KEY,
      baseUrl: 'https://api.paystack.co'
    },
    flutterwave: {
      secretKey: process.env.FLUTTERWAVE_TEST_KEY,
      baseUrl: 'https://developersandbox-api.flutterwave.com'
    }
  }
};
```

### Test Account Numbers

```
Paystack Test:
- Account Number: 0001234567
- Bank Code: 058 (GTB Test)
- Expected Name: Test Account

Flutterwave Test:
- Account Number: 0690000031
- Bank Code: 058 (GTB)
- Expected Name: Test User
```

## Monitoring and Analytics

### Payment Statistics

```typescript
const stats = paymentManager.getStatistics();
console.log('Total transactions:', stats.totalTransactions);
console.log('Success rate:', stats.successfulTransactions / stats.totalTransactions);
console.log('Provider performance:', stats.providerStats);
```

### Health Monitoring

```typescript
const health = await PaymentService.getProviderStatus();
console.log('Healthy providers:', health.healthyProviders);
console.log('Provider status:', health.providers);
```

## Compliance Reporting

### Daily Compliance Report

```typescript
const report = NigerianCompliance.generateRegulatoryReport(
  transactions,
  'daily'
);

// Includes:
// - Total transaction volume
// - Suspicious activity count
// - High-value transactions
// - Payment method breakdown
// - Compliance score
```

### Data Retention

- **Bank Transfers**: 7 years (CBN requirement)
- **Mobile Money**: 5 years
- **USSD Transactions**: 3 years
- **Audit Logs**: 7 years

## Deployment

### Production Checklist

1. ✅ Configure provider API keys
2. ✅ Set up webhook endpoints
3. ✅ Configure fallback providers
4. ✅ Set up monitoring and alerts
5. ✅ Test compliance features
6. ✅ Review transaction limits
7. ✅ Configure security headers
8. ✅ Set up rate limiting
9. ✅ Test failover scenarios
10. ✅ Verify data retention policies

### Environment Variables Production

```bash
# Security headers
NEXT_PUBLIC_API_BASE_URL=https://amac.gov.ng/api
PAYMENT_WEBHOOK_URL=https://amac.gov.ng/api/webhooks

# Rate limiting
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW=900000

# Security
CORS_ORIGINS=https://amac.gov.ng,https://payments.amac.gov.ng
SESSION_SECRET=your-secure-session-secret
```

## Support and Troubleshooting

### Common Issues

1. **Account Verification Fails**
   - Check bank code is correct
   - Verify account number is 10 digits
   - Ensure bank is supported

2. **Payment Processing Fails**
   - Check API key configuration
   - Verify webhook setup
   - Check provider status

3. **Compliance Violations**
   - Review transaction limits
   - Check BVN verification
   - Monitor risk scores

### Contact Information

- **Paystack Support**: support@paystack.co
- **Flutterwave Support**: support@flutterwave.com
- **CBN Guidelines**: www.cbn.gov.ng

### Emergency Procedures

1. **Service Outage**: Switch to fallback provider
2. **Security Breach**: Revoke API keys immediately
3. **High Volume**: Enable rate limiting
4. **Regulatory Audit**: Export compliance reports

## Future Enhancements

### Planned Features

1. **InterSwitch Integration**: Additional payment provider
2. **Biometric Authentication**: Fingerprint/Face ID
3. **QR Code Payments**: Offline payment capability
4. **Voice Payments**: IVR system integration
5. **Blockchain Settlement**: Faster settlement times

### Integration Opportunities

1. **Bank APIs**: Direct bank integration
2. **Government Payment Gateway**: Treasury integration
3. **International Remittances**: Cross-border payments
4. **Cryptocurrency**: USDT/USDC integration

---

This comprehensive integration transforms the AMAC payment system from a mock implementation to a production-ready, CBN-compliant payment processing platform supporting all major Nigerian payment methods with robust fallback mechanisms and comprehensive compliance features.