const dbManager = require('../config/database');
const logger = require('../utils/logger');

class PaymentReconciliation {
  
  // Payment modes enum
  static PAYMENT_MODES = {
    BANK_COUNTER: 'BANK_COUNTER',
    BILLSAHULIYAT_PLUS: 'BILLSAHULIYAT_PLUS',
    SMART_BS: 'SMART_BS',
    JK_BANK_MPAY: 'JK_BANK_MPAY',
    BBPS: 'BBPS',
    POS_MACHINES: 'POS_MACHINES'
  };

  // Settlement periods
  static SETTLEMENT_PERIODS = {
    T0: 'T+0',
    T1: 'T+1'
  };

  // Reconciliation status
  static RECONCILIATION_STATUS = {
    MATCHED: 'MATCHED',
    UNMATCHED_CORPORTAL: 'UNMATCHED_CORPORTAL', // Payment in CORPORTAL but not in CCB
    UNMATCHED_CCB: 'UNMATCHED_CCB',             // Payment in CCB but not in CORPORTAL
    AMOUNT_MISMATCH: 'AMOUNT_MISMATCH',         // Partial matches with amount differences
    PENDING_POSTING: 'PENDING_POSTING'          // Within settlement period, awaiting posting
  };

  /**
   * Get payment summary from CORPORTAL database
   * @param {Date} fromDate 
   * @param {Date} toDate 
   * @param {string} paymentMode 
   * @returns {Array} Payment summary data
   */
  static async getCorportalPayments(fromDate, toDate, paymentMode = null) {
    try {
      let query = `
        SELECT 
          CONSUMER_ID,
          PAYMENT_MODE,
          AMOUNT,
          TRANSACTION_ID,
          PAYMENT_DATE,
          BANK_REF_NUMBER,
          STATUS,
          CREATED_DATE
        FROM CORPORTAL_PAYMENTS 
        WHERE PAYMENT_DATE BETWEEN :fromDate AND :toDate
      `;
      
      const params = { fromDate, toDate };
      
      if (paymentMode) {
        query += ' AND PAYMENT_MODE = :paymentMode';
        params.paymentMode = paymentMode;
      }
      
      query += ' ORDER BY PAYMENT_DATE DESC';
      
      const results = await dbManager.executeCorportalQuery(query, params);
      
      logger.info(`Retrieved ${results.length} CORPORTAL payments for date range ${fromDate} to ${toDate}`);
      return results;
      
    } catch (error) {
      logger.error('Error fetching CORPORTAL payments:', error);
      throw error;
    }
  }

  /**
   * Get posted payments from CCB database
   * @param {Date} fromDate 
   * @param {Date} toDate 
   * @param {string} paymentMode 
   * @returns {Array} CCB payment postings
   */
  static async getCCBPayments(fromDate, toDate, paymentMode = null) {
    try {
      let query = `
        SELECT 
          CONSUMER_NO AS CONSUMER_ID,
          PAYMENT_MODE,
          PAID_AMOUNT AS AMOUNT,
          TRANSACTION_REF,
          PAYMENT_DATE,
          POSTING_DATE,
          PAYMENT_STATUS,
          CREATED_DATE
        FROM CCB_PAYMENTS 
        WHERE POSTING_DATE BETWEEN :fromDate AND :toDate
      `;
      
      const params = { fromDate, toDate };
      
      if (paymentMode) {
        query += ' AND PAYMENT_MODE = :paymentMode';
        params.paymentMode = paymentMode;
      }
      
      query += ' ORDER BY POSTING_DATE DESC';
      
      const results = await dbManager.executeCCBQuery(query, params);
      
      logger.info(`Retrieved ${results.length} CCB payments for date range ${fromDate} to ${toDate}`);
      return results;
      
    } catch (error) {
      logger.error('Error fetching CCB payments:', error);
      throw error;
    }
  }

  /**
   * Get reconciliation summary for dashboard
   * @param {Date} fromDate 
   * @param {Date} toDate 
   * @returns {Object} Reconciliation summary
   */
  static async getReconciliationSummary(fromDate, toDate) {
    try {
      const corportalPayments = await this.getCorportalPayments(fromDate, toDate);
      const ccbPayments = await this.getCCBPayments(fromDate, toDate);
      
      // Create maps for easier matching
      const corportalMap = new Map();
      const ccbMap = new Map();
      
      // Group CORPORTAL payments
      corportalPayments.forEach(payment => {
        const key = `${payment.CONSUMER_ID}-${payment.AMOUNT}-${payment.PAYMENT_MODE}`;
        if (!corportalMap.has(key)) {
          corportalMap.set(key, []);
        }
        corportalMap.get(key).push(payment);
      });
      
      // Group CCB payments
      ccbPayments.forEach(payment => {
        const key = `${payment.CONSUMER_ID}-${payment.AMOUNT}-${payment.PAYMENT_MODE}`;
        if (!ccbMap.has(key)) {
          ccbMap.set(key, []);
        }
        ccbMap.get(key).push(payment);
      });
      
      // Calculate summary statistics
      const summary = {
        corportalTotal: corportalPayments.reduce((sum, p) => sum + Number(p.AMOUNT), 0),
        ccbTotal: ccbPayments.reduce((sum, p) => sum + Number(p.AMOUNT), 0),
        corportalCount: corportalPayments.length,
        ccbCount: ccbPayments.length,
        matchedCount: 0,
        unmatchedCorportalCount: 0,
        unmatchedCCBCount: 0,
        amountMismatchCount: 0,
        byPaymentMode: {}
      };
      
      // Count matches and exceptions
      const allKeys = new Set([...corportalMap.keys(), ...ccbMap.keys()]);
      
      allKeys.forEach(key => {
        const corportalRecords = corportalMap.get(key) || [];
        const ccbRecords = ccbMap.get(key) || [];
        
        if (corportalRecords.length > 0 && ccbRecords.length > 0) {
          summary.matchedCount += Math.min(corportalRecords.length, ccbRecords.length);
          
          // Check for amount mismatches
          if (corportalRecords.length !== ccbRecords.length) {
            summary.amountMismatchCount += Math.abs(corportalRecords.length - ccbRecords.length);
          }
        } else if (corportalRecords.length > 0) {
          summary.unmatchedCorportalCount += corportalRecords.length;
        } else if (ccbRecords.length > 0) {
          summary.unmatchedCCBCount += ccbRecords.length;
        }
      });
      
      // Summary by payment mode
      Object.values(this.PAYMENT_MODES).forEach(mode => {
        const corportalModePayments = corportalPayments.filter(p => p.PAYMENT_MODE === mode);
        const ccbModePayments = ccbPayments.filter(p => p.PAYMENT_MODE === mode);
        
        summary.byPaymentMode[mode] = {
          corportalAmount: corportalModePayments.reduce((sum, p) => sum + Number(p.AMOUNT), 0),
          ccbAmount: ccbModePayments.reduce((sum, p) => sum + Number(p.AMOUNT), 0),
          corportalCount: corportalModePayments.length,
          ccbCount: ccbModePayments.length,
          variance: 0
        };
        
        summary.byPaymentMode[mode].variance = 
          summary.byPaymentMode[mode].corportalAmount - summary.byPaymentMode[mode].ccbAmount;
      });
      
      logger.info(`Reconciliation summary generated for ${fromDate} to ${toDate}`);
      return summary;
      
    } catch (error) {
      logger.error('Error generating reconciliation summary:', error);
      throw error;
    }
  }

  /**
   * Get detailed exceptions requiring manual review
   * @param {Date} fromDate 
   * @param {Date} toDate 
   * @returns {Array} Exception records
   */
  static async getExceptions(fromDate, toDate) {
    try {
      const corportalPayments = await this.getCorportalPayments(fromDate, toDate);
      const ccbPayments = await this.getCCBPayments(fromDate, toDate);
      
      const exceptions = [];
      const corportalMap = new Map();
      const ccbMap = new Map();
      
      // Create lookup maps
      corportalPayments.forEach(payment => {
        const key = `${payment.CONSUMER_ID}-${payment.AMOUNT}-${payment.PAYMENT_MODE}`;
        corportalMap.set(key, payment);
      });
      
      ccbPayments.forEach(payment => {
        const key = `${payment.CONSUMER_ID}-${payment.AMOUNT}-${payment.PAYMENT_MODE}`;
        ccbMap.set(key, payment);
      });
      
      // Find unmatched CORPORTAL payments
      corportalPayments.forEach(payment => {
        const key = `${payment.CONSUMER_ID}-${payment.AMOUNT}-${payment.PAYMENT_MODE}`;
        if (!ccbMap.has(key)) {
          exceptions.push({
            type: this.RECONCILIATION_STATUS.UNMATCHED_CORPORTAL,
            consumerID: payment.CONSUMER_ID,
            amount: payment.AMOUNT,
            paymentMode: payment.PAYMENT_MODE,
            transactionID: payment.TRANSACTION_ID,
            paymentDate: payment.PAYMENT_DATE,
            corportalRecord: payment,
            ccbRecord: null,
            description: 'Payment received but not posted to CCB'
          });
        }
      });
      
      // Find unmatched CCB payments
      ccbPayments.forEach(payment => {
        const key = `${payment.CONSUMER_ID}-${payment.AMOUNT}-${payment.PAYMENT_MODE}`;
        if (!corportalMap.has(key)) {
          exceptions.push({
            type: this.RECONCILIATION_STATUS.UNMATCHED_CCB,
            consumerID: payment.CONSUMER_ID,
            amount: payment.AMOUNT,
            paymentMode: payment.PAYMENT_MODE,
            transactionID: payment.TRANSACTION_REF,
            paymentDate: payment.PAYMENT_DATE,
            corportalRecord: null,
            ccbRecord: payment,
            description: 'Payment posted to CCB but not found in CORPORTAL'
          });
        }
      });
      
      logger.info(`Found ${exceptions.length} exceptions for manual review`);
      return exceptions;
      
    } catch (error) {
      logger.error('Error fetching exceptions:', error);
      throw error;
    }
  }

  /**
   * Get payment trends for analytics
   * @param {Date} fromDate 
   * @param {Date} toDate 
   * @returns {Array} Daily payment trends
   */
  static async getPaymentTrends(fromDate, toDate) {
    try {
      const corportalQuery = `
        SELECT 
          TRUNC(PAYMENT_DATE) as PAYMENT_DAY,
          PAYMENT_MODE,
          COUNT(*) as TRANSACTION_COUNT,
          SUM(AMOUNT) as TOTAL_AMOUNT
        FROM CORPORTAL_PAYMENTS 
        WHERE PAYMENT_DATE BETWEEN :fromDate AND :toDate
        GROUP BY TRUNC(PAYMENT_DATE), PAYMENT_MODE
        ORDER BY PAYMENT_DAY DESC, PAYMENT_MODE
      `;
      
      const ccbQuery = `
        SELECT 
          TRUNC(POSTING_DATE) as POSTING_DAY,
          PAYMENT_MODE,
          COUNT(*) as TRANSACTION_COUNT,
          SUM(PAID_AMOUNT) as TOTAL_AMOUNT
        FROM CCB_PAYMENTS 
        WHERE POSTING_DATE BETWEEN :fromDate AND :toDate
        GROUP BY TRUNC(POSTING_DATE), PAYMENT_MODE
        ORDER BY POSTING_DAY DESC, PAYMENT_MODE
      `;
      
      const [corportalTrends, ccbTrends] = await Promise.all([
        dbManager.executeCorportalQuery(corportalQuery, { fromDate, toDate }),
        dbManager.executeCCBQuery(ccbQuery, { fromDate, toDate })
      ]);
      
      logger.info('Payment trends data retrieved successfully');
      return { corportalTrends, ccbTrends };
      
    } catch (error) {
      logger.error('Error fetching payment trends:', error);
      throw error;
    }
  }
}

module.exports = PaymentReconciliation;