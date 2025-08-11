const dbManager = require('../config/database');
const logger = require('../utils/logger');
const moment = require('moment');

class ReconciliationService {

  /**
   * Advanced reconciliation with fuzzy matching and tolerance
   * @param {Date} fromDate 
   * @param {Date} toDate 
   * @param {Object} options - Reconciliation options
   * @returns {Object} Detailed reconciliation results
   */
  static async performDetailedReconciliation(fromDate, toDate, options = {}) {
    const {
      amountTolerance = 0.01, // Allow 1 paisa difference
      daysTolerance = 2,      // Allow 2 days difference for settlement
      includePartialMatches = true
    } = options;

    try {
      // Advanced SQL queries with better performance
      const corportalQuery = `
        SELECT 
          CONSUMER_ID,
          PAYMENT_MODE,
          AMOUNT,
          TRANSACTION_ID,
          PAYMENT_DATE,
          BANK_REF_NUMBER,
          STATUS,
          ROWID as CORPORTAL_ROWID
        FROM CORPORTAL_PAYMENTS 
        WHERE PAYMENT_DATE BETWEEN :fromDate AND :toDate
        AND STATUS = 'SUCCESS'
        ORDER BY PAYMENT_DATE, CONSUMER_ID
      `;

      const ccbQuery = `
        SELECT 
          CONSUMER_NO AS CONSUMER_ID,
          PAYMENT_MODE,
          PAID_AMOUNT AS AMOUNT,
          TRANSACTION_REF,
          PAYMENT_DATE,
          POSTING_DATE,
          PAYMENT_STATUS,
          ROWID as CCB_ROWID
        FROM CCB_PAYMENTS 
        WHERE POSTING_DATE BETWEEN :fromDate AND :toDate
        AND PAYMENT_STATUS = 'POSTED'
        ORDER BY POSTING_DATE, CONSUMER_NO
      `;

      const [corportalPayments, ccbPayments] = await Promise.all([
        dbManager.executeCorportalQuery(corportalQuery, { fromDate, toDate }),
        dbManager.executeCCBQuery(ccbQuery, { fromDate, toDate })
      ]);

      const results = {
        summary: {
          totalCorportalPayments: corportalPayments.length,
          totalCCBPayments: ccbPayments.length,
          totalCorportalAmount: 0,
          totalCCBAmount: 0,
          matchedPayments: 0,
          matchedAmount: 0,
          unmatchedCorportal: 0,
          unmatchedCCB: 0,
          partialMatches: 0,
          processingDate: new Date()
        },
        matches: [],
        exceptions: [],
        partialMatches: []
      };

      // Calculate totals
      results.summary.totalCorportalAmount = corportalPayments
        .reduce((sum, p) => sum + parseFloat(p.AMOUNT || 0), 0);
      results.summary.totalCCBAmount = ccbPayments
        .reduce((sum, p) => sum + parseFloat(p.AMOUNT || 0), 0);

      // Create indexed maps for faster lookup
      const corportalIndex = this.createPaymentIndex(corportalPayments);
      const ccbIndex = this.createPaymentIndex(ccbPayments);
      
      const matchedCorportalIds = new Set();
      const matchedCCBIds = new Set();

      // Exact matching first
      corportalPayments.forEach(corpPayment => {
        const exactKey = `${corpPayment.CONSUMER_ID}-${corpPayment.AMOUNT}-${corpPayment.PAYMENT_MODE}`;
        const ccbMatches = ccbIndex.exact[exactKey];
        
        if (ccbMatches && ccbMatches.length > 0) {
          // Find the best date match within settlement window
          const bestMatch = this.findBestDateMatch(corpPayment, ccbMatches, daysTolerance);
          
          if (bestMatch) {
            results.matches.push({
              type: 'EXACT_MATCH',
              corportalPayment: corpPayment,
              ccbPayment: bestMatch,
              matchScore: 1.0,
              dateDifference: this.calculateDateDifference(corpPayment.PAYMENT_DATE, bestMatch.POSTING_DATE)
            });
            
            matchedCorportalIds.add(corpPayment.CORPORTAL_ROWID);
            matchedCCBIds.add(bestMatch.CCB_ROWID);
            results.summary.matchedPayments++;
            results.summary.matchedAmount += parseFloat(corpPayment.AMOUNT);
          }
        }
      });

      // Fuzzy matching for remaining records if enabled
      if (includePartialMatches) {
        const unmatchedCorportal = corportalPayments
          .filter(p => !matchedCorportalIds.has(p.CORPORTAL_ROWID));
        const unmatchedCCB = ccbPayments
          .filter(p => !matchedCCBIds.has(p.CCB_ROWID));

        // Amount-based fuzzy matching
        unmatchedCorportal.forEach(corpPayment => {
          const fuzzyMatches = this.findFuzzyMatches(
            corpPayment, 
            unmatchedCCB, 
            amountTolerance, 
            daysTolerance
          );
          
          if (fuzzyMatches.length > 0) {
            const bestMatch = fuzzyMatches[0]; // Already sorted by score
            
            if (bestMatch.score >= 0.8) { // High confidence threshold
              results.partialMatches.push({
                type: 'FUZZY_MATCH',
                corportalPayment: corpPayment,
                ccbPayment: bestMatch.payment,
                matchScore: bestMatch.score,
                reasons: bestMatch.reasons,
                amountDifference: Math.abs(
                  parseFloat(corpPayment.AMOUNT) - parseFloat(bestMatch.payment.AMOUNT)
                )
              });
              
              matchedCorportalIds.add(corpPayment.CORPORTAL_ROWID);
              matchedCCBIds.add(bestMatch.payment.CCB_ROWID);
              results.summary.partialMatches++;
            }
          }
        });
      }

      // Identify final exceptions
      results.exceptions = [
        ...corportalPayments
          .filter(p => !matchedCorportalIds.has(p.CORPORTAL_ROWID))
          .map(p => ({
            type: 'UNMATCHED_CORPORTAL',
            payment: p,
            reason: 'Payment received but not posted to CCB',
            daysSincePayment: this.calculateDaysDifference(p.PAYMENT_DATE, new Date()),
            requiresAction: this.requiresActionCheck(p)
          })),
        ...ccbPayments
          .filter(p => !matchedCCBIds.has(p.CCB_ROWID))
          .map(p => ({
            type: 'UNMATCHED_CCB',
            payment: p,
            reason: 'Payment posted to CCB but not found in CORPORTAL',
            daysSincePosting: this.calculateDaysDifference(p.POSTING_DATE, new Date()),
            requiresAction: true
          }))
      ];

      results.summary.unmatchedCorportal = results.exceptions
        .filter(e => e.type === 'UNMATCHED_CORPORTAL').length;
      results.summary.unmatchedCCB = results.exceptions
        .filter(e => e.type === 'UNMATCHED_CCB').length;

      logger.info(`Reconciliation completed: ${results.summary.matchedPayments} matched, ${results.summary.unmatchedCorportal + results.summary.unmatchedCCB} exceptions`);
      
      return results;

    } catch (error) {
      logger.error('Detailed reconciliation failed:', error);
      throw error;
    }
  }

  /**
   * Create indexed maps for faster payment lookup
   */
  static createPaymentIndex(payments) {
    const index = {
      exact: {},
      byConsumer: {},
      byAmount: {},
      byDate: {}
    };

    payments.forEach(payment => {
      // Exact match index
      const exactKey = `${payment.CONSUMER_ID}-${payment.AMOUNT}-${payment.PAYMENT_MODE}`;
      if (!index.exact[exactKey]) index.exact[exactKey] = [];
      index.exact[exactKey].push(payment);

      // Consumer index
      if (!index.byConsumer[payment.CONSUMER_ID]) index.byConsumer[payment.CONSUMER_ID] = [];
      index.byConsumer[payment.CONSUMER_ID].push(payment);

      // Amount index (rounded for fuzzy matching)
      const amountKey = Math.round(parseFloat(payment.AMOUNT));
      if (!index.byAmount[amountKey]) index.byAmount[amountKey] = [];
      index.byAmount[amountKey].push(payment);

      // Date index
      const dateKey = moment(payment.PAYMENT_DATE || payment.POSTING_DATE).format('YYYY-MM-DD');
      if (!index.byDate[dateKey]) index.byDate[dateKey] = [];
      index.byDate[dateKey].push(payment);
    });

    return index;
  }

  /**
   * Find best date match within settlement window
   */
  static findBestDateMatch(corportalPayment, ccbMatches, daysTolerance) {
    const corportalDate = moment(corportalPayment.PAYMENT_DATE);
    
    let bestMatch = null;
    let smallestDateDiff = Infinity;

    ccbMatches.forEach(ccbPayment => {
      const ccbDate = moment(ccbPayment.POSTING_DATE);
      const daysDiff = Math.abs(corportalDate.diff(ccbDate, 'days'));
      
      if (daysDiff <= daysTolerance && daysDiff < smallestDateDiff) {
        smallestDateDiff = daysDiff;
        bestMatch = ccbPayment;
      }
    });

    return bestMatch;
  }

  /**
   * Find fuzzy matches using multiple criteria
   */
  static findFuzzyMatches(corportalPayment, ccbPayments, amountTolerance, daysTolerance) {
    const matches = [];
    const corportalAmount = parseFloat(corportalPayment.AMOUNT);
    const corportalDate = moment(corportalPayment.PAYMENT_DATE);

    ccbPayments.forEach(ccbPayment => {
      const ccbAmount = parseFloat(ccbPayment.AMOUNT);
      const ccbDate = moment(ccbPayment.POSTING_DATE);
      
      const score = this.calculateMatchScore(
        corportalPayment,
        ccbPayment,
        corportalAmount,
        ccbAmount,
        corportalDate,
        ccbDate,
        amountTolerance,
        daysTolerance
      );

      if (score > 0) {
        matches.push({
          payment: ccbPayment,
          score,
          reasons: this.getMatchReasons(corportalPayment, ccbPayment, score)
        });
      }
    });

    // Sort by score descending
    return matches.sort((a, b) => b.score - a.score);
  }

  /**
   * Calculate match score based on multiple factors
   */
  static calculateMatchScore(corpPayment, ccbPayment, corpAmount, ccbAmount, corpDate, ccbDate, amountTolerance, daysTolerance) {
    let score = 0;
    const factors = [];

    // Consumer ID match (highest weight)
    if (corpPayment.CONSUMER_ID === ccbPayment.CONSUMER_ID) {
      score += 0.4;
      factors.push('Consumer ID match');
    }

    // Payment Mode match
    if (corpPayment.PAYMENT_MODE === ccbPayment.PAYMENT_MODE) {
      score += 0.3;
      factors.push('Payment mode match');
    }

    // Amount match with tolerance
    const amountDiff = Math.abs(corpAmount - ccbAmount);
    if (amountDiff <= amountTolerance) {
      score += 0.25;
      factors.push('Amount match within tolerance');
    } else if (amountDiff <= (corpAmount * 0.01)) { // 1% tolerance
      score += 0.15;
      factors.push('Amount close match');
    }

    // Date proximity
    const daysDiff = Math.abs(corpDate.diff(ccbDate, 'days'));
    if (daysDiff <= daysTolerance) {
      const dateScore = 0.05 * (1 - (daysDiff / daysTolerance));
      score += dateScore;
      factors.push(`Date within ${daysDiff} days`);
    }

    return score;
  }

  /**
   * Get reasons for match scoring
   */
  static getMatchReasons(corpPayment, ccbPayment, score) {
    const reasons = [];
    
    if (corpPayment.CONSUMER_ID === ccbPayment.CONSUMER_ID) {
      reasons.push('Same consumer ID');
    }
    
    if (corpPayment.PAYMENT_MODE === ccbPayment.PAYMENT_MODE) {
      reasons.push('Same payment mode');
    }
    
    const amountDiff = Math.abs(parseFloat(corpPayment.AMOUNT) - parseFloat(ccbPayment.AMOUNT));
    if (amountDiff < 0.01) {
      reasons.push('Exact amount match');
    } else if (amountDiff < 1) {
      reasons.push(`Amount difference: ₹${amountDiff.toFixed(2)}`);
    }
    
    if (score > 0.9) {
      reasons.push('High confidence match');
    } else if (score > 0.7) {
      reasons.push('Good match');
    } else {
      reasons.push('Potential match - requires review');
    }
    
    return reasons;
  }

  /**
   * Calculate date difference in days
   */
  static calculateDateDifference(date1, date2) {
    return moment(date2).diff(moment(date1), 'days');
  }

  /**
   * Calculate days difference (absolute)
   */
  static calculateDaysDifference(date1, date2) {
    return Math.abs(moment(date2).diff(moment(date1), 'days'));
  }

  /**
   * Check if unmatched payment requires immediate action
   */
  static requiresActionCheck(payment) {
    const daysSincePayment = this.calculateDaysDifference(payment.PAYMENT_DATE, new Date());
    const settlementDays = payment.PAYMENT_MODE === 'BANK_COUNTER' ? 1 : 2; // T+0 vs T+1
    
    return daysSincePayment > settlementDays;
  }

  /**
   * Get reconciliation statistics for a date range
   */
  static async getReconciliationStats(fromDate, toDate) {
    try {
      const reconciliationResult = await this.performDetailedReconciliation(fromDate, toDate);
      
      const stats = {
        ...reconciliationResult.summary,
        reconciliationEfficiency: (reconciliationResult.summary.matchedPayments / 
          reconciliationResult.summary.totalCorportalPayments) * 100,
        amountReconciliationRate: (reconciliationResult.summary.matchedAmount / 
          reconciliationResult.summary.totalCorportalAmount) * 100,
        criticalExceptions: reconciliationResult.exceptions.filter(e => e.requiresAction).length,
        avgSettlementDays: this.calculateAverageSettlementDays(reconciliationResult.matches)
      };

      return stats;

    } catch (error) {
      logger.error('Error calculating reconciliation stats:', error);
      throw error;
    }
  }

  /**
   * Calculate average settlement days for matched payments
   */
  static calculateAverageSettlementDays(matches) {
    if (matches.length === 0) return 0;
    
    const totalDays = matches.reduce((sum, match) => sum + Math.abs(match.dateDifference), 0);
    return (totalDays / matches.length).toFixed(1);
  }
}

module.exports = ReconciliationService;