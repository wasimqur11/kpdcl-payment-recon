const moment = require('moment');

// Mock data generator for demo purposes when database is not available
class MockDataService {
  
  static generateMockPayments(count = 50, daysBack = 7) {
    const payments = [];
    const paymentModes = ['BANK_COUNTER', 'BILLSAHULIYAT_PLUS', 'SMART_BS', 'JK_BANK_MPAY', 'BBPS', 'POS_MACHINES'];
    const consumerIds = Array.from({length: 20}, (_, i) => `CON${String(i + 1).padStart(3, '0')}`);
    
    for (let i = 0; i < count; i++) {
      const paymentDate = moment().subtract(Math.floor(Math.random() * daysBack), 'days').toDate();
      const mode = paymentModes[Math.floor(Math.random() * paymentModes.length)];
      const consumerId = consumerIds[Math.floor(Math.random() * consumerIds.length)];
      const amount = Math.round((Math.random() * 5000 + 500) * 100) / 100;
      
      payments.push({
        CONSUMER_ID: consumerId,
        PAYMENT_MODE: mode,
        AMOUNT: amount,
        TRANSACTION_ID: `TXN${Date.now()}${i}`,
        PAYMENT_DATE: paymentDate,
        BANK_REF_NUMBER: `BANK${Math.floor(Math.random() * 100000)}`,
        STATUS: 'SUCCESS',
        CREATED_DATE: paymentDate
      });
    }
    
    return payments;
  }
  
  static generateMockCCBPayments(corportalPayments) {
    const ccbPayments = [];
    
    // 90% of CORPORTAL payments have corresponding CCB entries
    corportalPayments.forEach((payment, index) => {
      if (Math.random() < 0.9) { // 90% match rate
        const postingDelay = payment.PAYMENT_MODE === 'BANK_COUNTER' ? 0 : 1; // T+0 vs T+1
        const postingDate = moment(payment.PAYMENT_DATE).add(postingDelay, 'days').toDate();
        
        ccbPayments.push({
          CONSUMER_ID: payment.CONSUMER_ID,
          PAYMENT_MODE: payment.PAYMENT_MODE,
          AMOUNT: payment.AMOUNT,
          TRANSACTION_REF: payment.TRANSACTION_ID,
          PAYMENT_DATE: payment.PAYMENT_DATE,
          POSTING_DATE: postingDate,
          PAYMENT_STATUS: 'POSTED',
          CREATED_DATE: postingDate
        });
      }
    });
    
    // Add some orphaned CCB payments (posted but not in CORPORTAL)
    const orphanedPayments = this.generateMockPayments(5, 3);
    orphanedPayments.forEach((payment, index) => {
      ccbPayments.push({
        CONSUMER_ID: payment.CONSUMER_ID,
        PAYMENT_MODE: payment.PAYMENT_MODE,
        AMOUNT: payment.AMOUNT,
        TRANSACTION_REF: `ORPHAN${Date.now()}${index}`,
        PAYMENT_DATE: payment.PAYMENT_DATE,
        POSTING_DATE: payment.PAYMENT_DATE,
        PAYMENT_STATUS: 'POSTED',
        CREATED_DATE: payment.CREATED_DATE
      });
    });
    
    return ccbPayments;
  }
  
  static getMockReconciliationSummary(fromDate, toDate) {
    const corportalPayments = this.generateMockPayments(100, 7);
    const ccbPayments = this.generateMockCCBPayments(corportalPayments);
    
    const corportalTotal = corportalPayments.reduce((sum, p) => sum + p.AMOUNT, 0);
    const ccbTotal = ccbPayments.reduce((sum, p) => sum + p.AMOUNT, 0);
    
    const byPaymentMode = {};
    const paymentModes = ['BANK_COUNTER', 'BILLSAHULIYAT_PLUS', 'SMART_BS', 'JK_BANK_MPAY', 'BBPS', 'POS_MACHINES'];
    
    paymentModes.forEach(mode => {
      const corportalModePayments = corportalPayments.filter(p => p.PAYMENT_MODE === mode);
      const ccbModePayments = ccbPayments.filter(p => p.PAYMENT_MODE === mode);
      
      const corportalAmount = corportalModePayments.reduce((sum, p) => sum + p.AMOUNT, 0);
      const ccbAmount = ccbModePayments.reduce((sum, p) => sum + p.AMOUNT, 0);
      
      byPaymentMode[mode] = {
        corportalAmount,
        ccbAmount,
        corportalCount: corportalModePayments.length,
        ccbCount: ccbModePayments.length,
        variance: corportalAmount - ccbAmount
      };
    });
    
    return {
      corportalTotal: Math.round(corportalTotal * 100) / 100,
      ccbTotal: Math.round(ccbTotal * 100) / 100,
      corportalCount: corportalPayments.length,
      ccbCount: ccbPayments.length,
      matchedCount: Math.floor(corportalPayments.length * 0.85),
      unmatchedCorportalCount: Math.floor(corportalPayments.length * 0.1),
      unmatchedCCBCount: Math.floor(corportalPayments.length * 0.05),
      amountMismatchCount: Math.floor(corportalPayments.length * 0.02),
      variance: Math.round((corportalTotal - ccbTotal) * 100) / 100,
      reconciliationRate: 85.5,
      byPaymentMode,
      lastUpdated: new Date().toISOString(),
      dateRange: { from: fromDate, to: toDate }
    };
  }
  
  static getMockExceptions(fromDate, toDate) {
    const exceptions = [];
    const consumerIds = Array.from({length: 10}, (_, i) => `CON${String(i + 1).padStart(3, '0')}`);
    const paymentModes = ['BANK_COUNTER', 'BILLSAHULIYAT_PLUS', 'SMART_BS', 'JK_BANK_MPAY'];
    
    // Generate unmatched CORPORTAL payments
    for (let i = 0; i < 8; i++) {
      exceptions.push({
        type: 'UNMATCHED_CORPORTAL',
        consumerID: consumerIds[Math.floor(Math.random() * consumerIds.length)],
        amount: Math.round((Math.random() * 2000 + 500) * 100) / 100,
        paymentMode: paymentModes[Math.floor(Math.random() * paymentModes.length)],
        transactionID: `TXN${Date.now()}${i}`,
        paymentDate: moment().subtract(Math.floor(Math.random() * 7), 'days').format('YYYY-MM-DD'),
        description: 'Payment received but not posted to CCB',
        requiresAction: Math.random() < 0.6,
        daysSincePayment: Math.floor(Math.random() * 7) + 1
      });
    }
    
    // Generate unmatched CCB payments
    for (let i = 0; i < 3; i++) {
      exceptions.push({
        type: 'UNMATCHED_CCB',
        consumerID: consumerIds[Math.floor(Math.random() * consumerIds.length)],
        amount: Math.round((Math.random() * 1500 + 300) * 100) / 100,
        paymentMode: paymentModes[Math.floor(Math.random() * paymentModes.length)],
        transactionID: `CCB${Date.now()}${i}`,
        paymentDate: moment().subtract(Math.floor(Math.random() * 5), 'days').format('YYYY-MM-DD'),
        description: 'Payment posted to CCB but not found in CORPORTAL',
        requiresAction: true,
        daysSincePayment: Math.floor(Math.random() * 5) + 1
      });
    }
    
    return exceptions;
  }
  
  static getMockPaymentTrends(fromDate, toDate) {
    const days = moment(toDate).diff(moment(fromDate), 'days') + 1;
    const corportalVsCCB = [];
    
    for (let i = 0; i < days; i++) {
      const date = moment(fromDate).add(i, 'days').format('YYYY-MM-DD');
      const corportalAmount = Math.round((Math.random() * 50000 + 20000) * 100) / 100;
      const ccbAmount = corportalAmount * (0.85 + Math.random() * 0.1); // Slight variance
      
      corportalVsCCB.push({
        date,
        corportal: corportalAmount,
        ccb: Math.round(ccbAmount * 100) / 100,
        variance: Math.round((corportalAmount - ccbAmount) * 100) / 100
      });
    }
    
    const byPaymentMode = {
      'BANK_COUNTER': { corportal: { count: 25, amount: 45000 }, ccb: { count: 24, amount: 44200 } },
      'BILLSAHULIYAT_PLUS': { corportal: { count: 30, amount: 52000 }, ccb: { count: 28, amount: 50800 } },
      'SMART_BS': { corportal: { count: 18, amount: 28000 }, ccb: { count: 17, amount: 27300 } },
      'JK_BANK_MPAY': { corportal: { count: 22, amount: 38000 }, ccb: { count: 21, amount: 37100 } },
      'BBPS': { corportal: { count: 15, amount: 22000 }, ccb: { count: 14, amount: 21500 } },
      'POS_MACHINES': { corportal: { count: 12, amount: 18000 }, ccb: { count: 11, amount: 17600 } }
    };
    
    return {
      trends: {
        daily: {},
        byPaymentMode,
        corportalVsCCB
      },
      raw: { corportalTrends: [], ccbTrends: [] }
    };
  }
  
  static getMockReconciliationStats(fromDate, toDate) {
    return {
      kpis: {
        totalCorportalPayments: 122,
        totalCCBPayments: 115,
        totalCorportalAmount: 203500.75,
        totalCCBAmount: 195230.50,
        matchedPayments: 104,
        matchedAmount: 185670.25,
        unmatchedCorportal: 11,
        unmatchedCCB: 4,
        partialMatches: 7,
        reconciliationEfficiency: 87.2,
        amountReconciliationRate: 91.3,
        criticalExceptions: 6,
        avgSettlementDays: '1.2',
        totalVariance: 8270.25,
        variancePercentage: '4.1',
        exceptionRate: '12.3',
        dataQualityScore: '87.7'
      }
    };
  }
}

module.exports = MockDataService;