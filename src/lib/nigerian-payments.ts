/**
 * Nigerian Payment System Utilities
 * Handles validation, formatting, and utilities for Nigerian payment methods
 */

export interface NigerianBank {
  code: string;
  name: string;
  slug: string;
  nubanLength: number;
}

export interface PaymentValidationResult {
  isValid: boolean;
  errors: string[];
  formattedValue?: string;
  bankName?: string;
}

export interface AccountVerificationResult {
  isValid: boolean;
  accountName?: string;
  bankName?: string;
  errorMessage?: string;
}

/**
 * List of Nigerian banks with their codes and NUBAN requirements
 */
export const NIGERIAN_BANKS: NigerianBank[] = [
  { code: "001", name: "Access Bank", slug: "access-bank", nubanLength: 10 },
  { code: "002", name: "Citibank Nigeria", slug: "citibank-nigeria", nubanLength: 10 },
  { code: "003", name: "Diamond Bank", slug: "diamond-bank", nubanLength: 10 },
  { code: "004", name: "United Bank for Africa", slug: "uba", nubanLength: 10 },
  { code: "005", name: "First Bank of Nigeria", slug: "first-bank", nubanLength: 10 },
  { code: "007", name: "EcoBank Nigeria", slug: "ecobank-nigeria", nubanLength: 10 },
  { code: "008", name: "Fidelity Bank", slug: "fidelity-bank", nubanLength: 10 },
  { code: "009", name: "First City Monument Bank", slug: "fcmb", nubanLength: 10 },
  { code: "010", name: "Unity Bank", slug: "unity-bank", nubanLength: 10 },
  { code: "011", name: "Stanbic IBTC Bank", slug: "stanbic-ibtc", nubanLength: 10 },
  { code: "012", name: "Standard Chartered Bank", slug: "standard-chartered", nubanLength: 10 },
  { code: "013", name: "Wema Bank", slug: "wema-bank", nubanLength: 10 },
  { code: "014", name: "Union Bank of Nigeria", slug: "union-bank", nubanLength: 10 },
  { code: "015", name: "Keystone Bank", slug: "keystone-bank", nubanLength: 10 },
  { code: "016", name: "Suntrust Bank", slug: "suntrust-bank", nubanLength: 10 },
  { code: "017", name: "Jaiz Bank", slug: "jaiz-bank", nubanLength: 10 },
  { code: "018", name: "Providus Bank", slug: "providus-bank", nubanLength: 10 },
  { code: "020", name: "Guaranty Trust Bank", slug: "gtb", nubanLength: 10 },
  { code: "021", name: "Heritage Bank", slug: "heritage-bank", nubanLength: 10 },
  { code: "022", name: "Skye Bank", slug: "skye-bank", nubanLength: 10 },
  { code: "023", name: "Sterling Bank", slug: "sterling-bank", nubanLength: 10 },
  { code: "025", name: "Parallex Bank", slug: "parallex-bank", nubanLength: 10 },
  { code: "030", name: "Lotus Bank", slug: "lotus-bank", nubanLength: 10 },
  { code: "032", name: "Standard Bank Nigeria", slug: "standard-bank-nigeria", nubanLength: 10 },
  { code: "035", name: "Titan Trust Bank", slug: "titan-trust-bank", nubanLength: 10 },
  { code: "038", name: "Optimus Bank", slug: "optimus-bank", nubanLength: 10 },
  { code: "044", name: "Access Bank (New)", slug: "access-bank-new", nubanLength: 10 },
  { code: "050", name: "Ecobank Nigeria", slug: "ecobank-nigeria-new", nubanLength: 10 },
  { code: "057", name: "Zenith Bank", slug: "zenith-bank", nubanLength: 10 },
  { code: "058", name: "Guaranty Trust Bank (New)", slug: "gtb-new", nubanLength: 10 },
  { code: "063", name: "United Bank for Africa (Digital)", slug: "uba-digital", nubanLength: 10 },
  { code: "068", name: "Standard Chartered Bank (Digital)", slug: "standard-chartered-digital", nubanLength: 10 },
  { code: "070", name: "Fidelity Bank (Digital)", slug: "fidelity-bank-digital", nubanLength: 10 },
  { code: "076", name: "Polaris Bank", slug: "polaris-bank", nubanLength: 10 },
  { code: "082", name: "Kuda Bank", slug: "kuda-bank", nubanLength: 10 },
  { code: "084", name: "VFD Microfinance Bank", slug: "vfd-microfinance", nubanLength: 10 },
  { code: "090", name: "Maya Bank", slug: "maya-bank", nubanLength: 10 },
  { code: "093", name: "TCF MFB", slug: "tcf-mfb", nubanLength: 10 },
  { code: "098", name: "Citis Trust Bank", slug: "citis-trust-bank", nubanLength: 10 },
  { code: "099", name: "Renaissance Microfinance Bank", slug: "renaissance-mfb", nubanLength: 10 },
  { code: "100", name: "Globus Bank", slug: "globus-bank", nubanLength: 10 },
  { code: "101", name: "Coronation Merchant Bank", slug: "coronation-merchant", nubanLength: 10 },
  { code: "102", name: "FSDH Merchant Bank", slug: "fsdh-merchant", nubanLength: 10 },
  { code: "103", name: "FBNQuest Merchant Bank", slug: "fbn-quest-merchant", nubanLength: 10 },
  { code: "104", name: "Halal Mortgage Bank", slug: "halal-mortgage", nubanLength: 10 },
  { code: "105", name: "Jubilee Mortgage Bank", slug: "jubilee-mortgage", nubanLength: 10 },
  { code: "106", name: "Homebase Mortgage Bank", slug: "homebase-mortgage", nubanLength: 10 },
  { code: "107", name: "Abbey Mortgage Bank", slug: "abbey-mortgage", nubanLength: 10 },
  { code: "108", name: "Infinity Trust Mortgage Bank", slug: "infinity-trust-mortgage", nubanLength: 10 },
  { code: "109", name: "Haggai Mortgage Bank", slug: "haggai-mortgage", nubanLength: 10 },
  { code: "110", name: "Lagos Building Investment Company", slug: "lbic", nubanLength: 10 },
  { code: "111", name: "Refuge Mortgage Bank", slug: "refuge-mortgage", nubanLength: 10 },
  { code: "112", name: "Trustbond Mortgage Bank", slug: "trustbond-mortgage", nubanLength: 10 },
  { code: "113", name: "Federal Mortgage Bank", slug: "federal-mortgage", nubanLength: 10 },
  { code: "114", name: "Cooperative Mortgage Bank", slug: "cooperative-mortgage", nubanLength: 10 },
  { code: "115", name: "Phoenix Mortgage Bank", slug: "phoenix-mortgage", nubanLength: 10 },
  { code: "301", name: "Ecobank Nigeria (Old)", slug: "ecobank-old", nubanLength: 10 },
  { code: "302", name: "International Bank", slug: "international-bank", nubanLength: 10 },
  { code: "303", name: "Standard Chartered Bank (Old)", slug: "standard-chartered-old", nubanLength: 10 },
  { code: "304", name: "United Bank for Africa (Old)", slug: "uba-old", nubanLength: 10 },
  { code: "305", name: "Wema Bank (Old)", slug: "wema-bank-old", nubanLength: 10 },
];

/**
 * Mobile Money Providers in Nigeria
 */
export const NIGERIAN_MOBILE_MONEY_PROVIDERS = [
  { code: "PAGA", name: "Paga", ussd: "*242#", logo: "/logos/paga.png" },
  { code: "OPAY", name: "OPay", ussd: "*955#", logo: "/logos/opay.png" },
  { code: "MTN_MOMO", name: "MTN MoMo", ussd: "*310#", logo: "/logos/mtn.png" },
  { code: "AIRTEL_TIGO", name: "AirtelTigo Money", ussd: "*110#", logo: "/logos/airtel.png" },
  { code: "GLO", name: "Glo Cash", ussd: "*500#", logo: "/logos/glo.png" },
  { code: "9PAY", name: "9Pay", ussd: "*950#", logo: "/logos/9pay.png" },
];

/**
 * USSD Banking Codes for Nigerian Banks
 */
export const NIGERIAN_BANK_USSD_CODES = [
  { bankCode: "001", bankName: "Access Bank", ussdCode: "*901#", shortCode: "901" },
  { bankCode: "005", bankName: "First Bank", ussdCode: "*894#", shortCode: "894" },
  { bankCode: "007", bankName: "EcoBank", ussdCode: "*326#", shortCode: "326" },
  { bankCode: "008", bankName: "Fidelity Bank", ussdCode: "*770#", shortCode: "770" },
  { bankCode: "010", bankName: "Unity Bank", ussdCode: "*7799#", shortCode: "7799" },
  { bankCode: "011", bankName: "Stanbic IBTC", ussdCode: "*909#", shortCode: "909" },
  { bankCode: "014", bankName: "Union Bank", ussdCode: "*826#", shortCode: "826" },
  { bankCode: "017", bankName: "JAIZ Bank", ussdCode: "*389*7#", shortCode: "3897" },
  { bankCode: "023", bankName: "Sterling Bank", ussdCode: "*822#", shortCode: "822" },
  { bankCode: "025", bankName: "Parallex Bank", ussdCode: "*323*0#", shortCode: "3230" },
  { bankCode: "032", bankName: "Union Bank (Old)", ussdCode: "*826#", shortCode: "826" },
  { bankCode: "035", bankName: "Titan Trust Bank", ussdCode: "*915#", shortCode: "915" },
  { bankCode: "044", bankName: "Access Bank (New)", ussdCode: "*901#", shortCode: "901" },
  { bankCode: "050", bankName: "EcoBank (New)", ussdCode: "*326#", shortCode: "326" },
  { bankCode: "057", bankName: "Zenith Bank", ussdCode: "*966#", shortCode: "966" },
  { bankCode: "058", bankName: "GTBank", ussdCode: "*737#", shortCode: "737" },
  { bankCode: "063", bankName: "Diamond Bank", ussdCode: "*710#", shortCode: "710" },
  { bankCode: "070", bankName: "Fidelity Bank (Digital)", ussdCode: "*770#", shortCode: "770" },
  { bankCode: "076", bankName: "Polaris Bank", ussdCode: "*833#", shortCode: "833" },
  { bankCode: "082", bankName: "Kuda Bank", ussdCode: "*567#", shortCode: "567" },
  { bankCode: "084", bankName: "VFD Microfinance", ussdCode: "*5037#", shortCode: "5037" },
];

/**
 * Validate Nigerian NUBAN account number
 */
export function validateNUBAN(accountNumber: string, bankCode?: string): PaymentValidationResult {
  const errors: string[] = [];
  let formattedValue = accountNumber.replace(/\s/g, '');

  // Remove any non-digit characters
  formattedValue = formattedValue.replace(/\D/g, '');

  // Check if account number is exactly 10 digits (NUBAN standard)
  if (formattedValue.length !== 10) {
    errors.push('Nigerian bank account numbers must be exactly 10 digits (NUBAN format)');
  }

  // Check if all digits are the same (invalid pattern)
  if (/^(\d)\1{9}$/.test(formattedValue)) {
    errors.push('Invalid account number pattern');
  }

  // Bank-specific validations if bank code is provided
  if (bankCode) {
    const bank = NIGERIAN_BANKS.find(b => b.code === bankCode);
    if (bank && formattedValue.length !== bank.nubanLength) {
      errors.push(`${bank.name} account numbers must be ${bank.nubanLength} digits`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    formattedValue: formattedValue.length === 10 ? formattedValue : undefined,
    bankName: bankCode ? NIGERIAN_BANKS.find(b => b.code === bankCode)?.name : undefined
  };
}

/**
 * Validate Nigerian phone number for mobile money
 */
export function validateNigerianPhoneNumber(phoneNumber: string): PaymentValidationResult {
  const errors: string[] = [];
  let formattedValue = phoneNumber.replace(/\s/g, '');

  // Remove any non-digit characters
  formattedValue = formattedValue.replace(/\D/g, '');

  // Nigerian phone number formats
  // +2348012345678, 08012345678, 8012345678
  const nigerianPhoneRegex = /^(\+?234|0)?[789][01]\d{8}$/;

  if (!nigerianPhoneRegex.test(formattedValue)) {
    errors.push('Invalid Nigerian phone number format. Use formats: +2348012345678, 08012345678, or 8012345678');
  }

  // Format to international format
  if (formattedValue.startsWith('0')) {
    formattedValue = '+234' + formattedValue.substring(1);
  } else if (!formattedValue.startsWith('+234')) {
    formattedValue = '+234' + formattedValue;
  }

  return {
    isValid: errors.length === 0,
    errors,
    formattedValue: errors.length === 0 ? formattedValue : undefined
  };
}

/**
 * Validate BVN (Bank Verification Number)
 */
export function validateBVN(bvn: string): PaymentValidationResult {
  const errors: string[] = [];
  let formattedValue = bvn.replace(/\s/g, '');

  // Remove any non-digit characters
  formattedValue = formattedValue.replace(/\D/g, '');

  // BVN must be exactly 11 digits
  if (formattedValue.length !== 11) {
    errors.push('BVN must be exactly 11 digits');
  }

  return {
    isValid: errors.length === 0,
    errors,
    formattedValue: formattedValue.length === 11 ? formattedValue : undefined
  };
}

/**
 * Get bank by code
 */
export function getBankByCode(bankCode: string): NigerianBank | undefined {
  return NIGERIAN_BANKS.find(bank => bank.code === bankCode);
}

/**
 * Get bank list formatted for dropdown/select
 */
export function getBankOptions(): Array<{ value: string; label: string; data: NigerianBank }> {
  return NIGERIAN_BANKS
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(bank => ({
      value: bank.code,
      label: `${bank.name} (${bank.code})`,
      data: bank
    }));
}

/**
 * Get mobile money provider options
 */
export function getMobileMoneyOptions(): Array<{ value: string; label: string; data: any }> {
  return NIGERIAN_MOBILE_MONEY_PROVIDERS.map(provider => ({
    value: provider.code,
    label: `${provider.name} (${provider.ussd})`,
    data: provider
  }));
}

/**
 * Format currency amount for display
 */
export function formatNaira(amount: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Validate payment amount for Nigerian context
 */
export function validatePaymentAmount(amount: number): PaymentValidationResult {
  const errors: string[] = [];

  if (isNaN(amount)) {
    errors.push('Amount must be a valid number');
  }

  if (amount <= 0) {
    errors.push('Amount must be greater than 0');
  }

  if (amount > 100000000) { // 100 million Naira limit
    errors.push('Amount exceeds maximum transaction limit');
  }

  // Check if amount is reasonable for agent payments
  if (amount < 1000) { // Minimum 1000 Naira
    errors.push('Minimum payment amount is ₦1,000');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Generate payment reference for Nigerian transactions
 */
export function generatePaymentReference(prefix: string = 'AMAC'): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}${timestamp}${random}`;
}

/**
 * Get payment method display name
 */
export function getPaymentMethodDisplay(method: string): string {
  const methodMap: { [key: string]: string } = {
    bank_transfer: 'Bank Transfer',
    mobile_money: 'Mobile Money',
    cash: 'Cash Payment',
    cheque: 'Cheque',
    other: 'Other',
    ussd: 'USSD Payment',
    card: 'Card Payment',
    pos: 'POS Terminal'
  };
  
  return methodMap[method] || method;
}

/**
 * Check if a payment method is available in Nigeria
 */
export function isPaymentMethodAvailable(method: string): boolean {
  const availableMethods = [
    'bank_transfer',
    'mobile_money', 
    'cash',
    'ussd',
    'card',
    'pos',
    'cheque'
  ];
  
  return availableMethods.includes(method);
}

/**
 * Get USSD code for bank
 */
export function getBankUSSDCode(bankCode: string): string | undefined {
  const bank = NIGERIAN_BANK_USSD_CODES.find(b => b.bankCode === bankCode);
  return bank?.ussdCode;
}

/**
 * Validate bank code
 */
export function validateBankCode(bankCode: string): PaymentValidationResult {
  const errors: string[] = [];

  if (!bankCode) {
    errors.push('Bank code is required');
    return { isValid: false, errors };
  }

  const bank = getBankByCode(bankCode);
  if (!bank) {
    errors.push('Invalid Nigerian bank code');
  }

  return {
    isValid: errors.length === 0,
    errors,
    bankName: bank?.name
  };
}