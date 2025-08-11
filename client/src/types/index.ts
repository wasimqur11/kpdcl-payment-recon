export interface PaymentRecord {
  CONSUMER_ID: string;
  PAYMENT_MODE: string;
  AMOUNT: number;
  TRANSACTION_ID: string;
  PAYMENT_DATE: string;
  BANK_REF_NUMBER?: string;
  STATUS: string;
  CREATED_DATE: string;
  POSTING_DATE?: string;
  TRANSACTION_REF?: string;
}

export interface ReconciliationSummary {
  corportalTotal: number;
  ccbTotal: number;
  corportalCount: number;
  ccbCount: number;
  matchedCount: number;
  unmatchedCorportalCount: number;
  unmatchedCCBCount: number;
  amountMismatchCount: number;
  variance: number;
  reconciliationRate: number;
  byPaymentMode: {
    [key: string]: {
      corportalAmount: number;
      ccbAmount: number;
      corportalCount: number;
      ccbCount: number;
      variance: number;
    };
  };
  lastUpdated: string;
  dateRange: {
    from: string;
    to: string;
  };
}

export interface PaymentException {
  type: 'UNMATCHED_CORPORTAL' | 'UNMATCHED_CCB' | 'AMOUNT_MISMATCH';
  consumerID: string;
  amount: number;
  paymentMode: string;
  transactionID: string;
  paymentDate: string;
  corportalRecord?: PaymentRecord;
  ccbRecord?: PaymentRecord;
  description: string;
  requiresAction?: boolean;
  daysSincePayment?: number;
}

export interface MatchedPayment {
  type: string;
  corportalPayment: PaymentRecord;
  ccbPayment: PaymentRecord;
  matchScore: number;
  dateDifference: number;
  reasons?: string[];
  amountDifference?: number;
}

export interface DetailedReconciliation {
  summary: {
    totalCorportalPayments: number;
    totalCCBPayments: number;
    totalCorportalAmount: number;
    totalCCBAmount: number;
    matchedPayments: number;
    matchedAmount: number;
    unmatchedCorportal: number;
    unmatchedCCB: number;
    partialMatches: number;
    processingDate: string;
  };
  matches: MatchedPayment[];
  exceptions: PaymentException[];
  partialMatches: MatchedPayment[];
  options?: {
    amountTolerance: number;
    daysTolerance: number;
    includePartialMatches: boolean;
  };
}

export interface PaymentTrend {
  date: string;
  corportal: number;
  ccb: number;
  variance: number;
}

export interface PaymentModeData {
  corportal: {
    count: number;
    amount: number;
  };
  ccb: {
    count: number;
    amount: number;
  };
}

export interface PaymentTrends {
  daily: {
    [date: string]: {
      corportal: { [mode: string]: PaymentModeData['corportal'] };
      ccb: { [mode: string]: PaymentModeData['ccb'] };
    };
  };
  byPaymentMode: {
    [mode: string]: PaymentModeData;
  };
  corportalVsCCB: PaymentTrend[];
}

export interface ReconciliationStats {
  totalCorportalPayments: number;
  totalCCBPayments: number;
  totalCorportalAmount: number;
  totalCCBAmount: number;
  matchedPayments: number;
  matchedAmount: number;
  unmatchedCorportal: number;
  unmatchedCCB: number;
  partialMatches: number;
  reconciliationEfficiency: number;
  amountReconciliationRate: number;
  criticalExceptions: number;
  avgSettlementDays: string;
  totalVariance: number;
  variancePercentage: string;
  exceptionRate: string;
  dataQualityScore: string;
}

export interface DateRangeFilter {
  fromDate: string;
  toDate: string;
}

export interface PaymentFilters extends DateRangeFilter {
  paymentMode?: string;
  consumerID?: string;
  severity?: 'critical' | 'all';
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
  success?: boolean;
  timestamp?: string;
}

export const PAYMENT_MODES = {
  BANK_COUNTER: 'Over the Counter (Bank)',
  BILLSAHULIYAT_PLUS: 'KPDCL Billsahuliyat Plus App',
  SMART_BS: 'Smart BS App',
  JK_BANK_MPAY: 'JK Bank Mpay App',
  BBPS: 'Bharat Bill Payment System',
  POS_MACHINES: 'Point of Sale Machines'
} as const;

export const SETTLEMENT_PERIODS = {
  T0: 'T+0',
  T1: 'T+1'
} as const;