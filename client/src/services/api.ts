import axios from 'axios';
import { 
  ReconciliationSummary, 
  DetailedReconciliation, 
  PaymentException, 
  PaymentTrends,
  ReconciliationStats,
  PaymentRecord,
  PaymentFilters,
  ApiResponse 
} from '../types';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for logging
apiClient.interceptors.request.use(
  (config) => {
    console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    
    if (error.response?.status === 401) {
      // Handle authentication errors
      console.error('Authentication required');
    } else if (error.response?.status >= 500) {
      console.error('Server error occurred');
    }
    
    return Promise.reject(error);
  }
);

export class DashboardAPI {
  
  static async getReconciliationSummary(
    fromDate: string, 
    toDate: string, 
    paymentMode?: string
  ): Promise<ReconciliationSummary> {
    try {
      const params = { fromDate, toDate };
      if (paymentMode) {
        (params as any).paymentMode = paymentMode;
      }
      
      const response = await apiClient.get('/dashboard/summary', { params });
      return response.data;
    } catch (error) {
      throw new Error('Failed to fetch reconciliation summary');
    }
  }

  static async getDetailedReconciliation(
    fromDate: string, 
    toDate: string,
    options?: {
      amountTolerance?: number;
      daysTolerance?: number;
      includePartialMatches?: boolean;
    }
  ): Promise<DetailedReconciliation> {
    try {
      const params = { fromDate, toDate, ...options };
      const response = await apiClient.get('/dashboard/detailed-reconciliation', { params });
      return response.data;
    } catch (error) {
      throw new Error('Failed to fetch detailed reconciliation');
    }
  }

  static async getExceptions(filters: PaymentFilters): Promise<{
    exceptions: PaymentException[];
    totalCount: number;
    criticalCount: number;
  }> {
    try {
      const response = await apiClient.get('/dashboard/exceptions', { params: filters });
      return response.data;
    } catch (error) {
      throw new Error('Failed to fetch exceptions');
    }
  }

  static async getPaymentTrends(
    fromDate: string, 
    toDate: string
  ): Promise<{ trends: PaymentTrends; raw: any }> {
    try {
      const params = { fromDate, toDate };
      const response = await apiClient.get('/dashboard/payment-trends', { params });
      return response.data;
    } catch (error) {
      throw new Error('Failed to fetch payment trends');
    }
  }

  static async getReconciliationStats(
    fromDate: string, 
    toDate: string
  ): Promise<{ kpis: ReconciliationStats }> {
    try {
      const params = { fromDate, toDate };
      const response = await apiClient.get('/dashboard/stats', { params });
      return response.data;
    } catch (error) {
      throw new Error('Failed to fetch reconciliation stats');
    }
  }

  static async getPaymentModes(): Promise<{
    paymentModes: Array<{
      key: string;
      value: string;
      displayName: string;
      settlementPeriod: string;
    }>;
    settlementPeriods: any;
    reconciliationStatuses: any;
  }> {
    try {
      const response = await apiClient.get('/dashboard/payment-modes');
      return response.data;
    } catch (error) {
      throw new Error('Failed to fetch payment modes');
    }
  }
}

export class ReconciliationAPI {
  
  static async runReconciliation(
    fromDate: string, 
    toDate: string, 
    options?: any
  ): Promise<{ success: boolean; result: DetailedReconciliation }> {
    try {
      const response = await apiClient.post('/reconciliation/run', {
        fromDate,
        toDate,
        options
      });
      return response.data;
    } catch (error) {
      throw new Error('Failed to run reconciliation');
    }
  }

  static async getCorportalPayments(
    filters: PaymentFilters & { limit?: number; offset?: number }
  ): Promise<{
    payments: PaymentRecord[];
    pagination: {
      total: number;
      limit: number;
      offset: number;
      hasMore: boolean;
    };
  }> {
    try {
      const response = await apiClient.get('/reconciliation/corportal-payments', { 
        params: filters 
      });
      return response.data;
    } catch (error) {
      throw new Error('Failed to fetch CORPORTAL payments');
    }
  }

  static async getCCBPayments(
    filters: PaymentFilters & { limit?: number; offset?: number }
  ): Promise<{
    payments: PaymentRecord[];
    pagination: {
      total: number;
      limit: number;
      offset: number;
      hasMore: boolean;
    };
  }> {
    try {
      const response = await apiClient.get('/reconciliation/ccb-payments', { 
        params: filters 
      });
      return response.data;
    } catch (error) {
      throw new Error('Failed to fetch CCB payments');
    }
  }

  static async getMatchDetails(
    consumerID: string,
    fromDate: string,
    toDate: string
  ): Promise<any> {
    try {
      const response = await apiClient.get(`/reconciliation/match-details/${consumerID}`, {
        params: { fromDate, toDate }
      });
      return response.data;
    } catch (error) {
      throw new Error('Failed to fetch match details');
    }
  }

  static async createManualMatch(
    corportalPaymentId: string,
    ccbPaymentId: string,
    reason: string
  ): Promise<{ success: boolean }> {
    try {
      const response = await apiClient.post('/reconciliation/manual-match', {
        corportalPaymentId,
        ccbPaymentId,
        reason
      });
      return response.data;
    } catch (error) {
      throw new Error('Failed to create manual match');
    }
  }

  static async exportData(
    fromDate: string,
    toDate: string,
    type: 'summary' | 'exceptions' | 'detailed',
    format: 'csv' | 'excel' = 'csv'
  ): Promise<any> {
    try {
      const response = await apiClient.get('/reconciliation/export', {
        params: { fromDate, toDate, type, format },
        responseType: 'blob'
      });
      return response.data;
    } catch (error) {
      throw new Error('Failed to export data');
    }
  }
}

// Utility functions
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(amount);
};

export const formatDate = (date: string): string => {
  return new Date(date).toLocaleDateString('en-IN');
};

export const formatDateTime = (date: string): string => {
  return new Date(date).toLocaleString('en-IN');
};

export const calculatePercentage = (value: number, total: number): string => {
  if (total === 0) return '0.00';
  return ((value / total) * 100).toFixed(2);
};

export const getVarianceColor = (variance: number): string => {
  if (variance === 0) return '#52c41a'; // Green
  if (Math.abs(variance) < 1000) return '#faad14'; // Orange
  return '#ff4d4f'; // Red
};