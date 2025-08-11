const express = require('express');
const router = express.Router();
const PaymentReconciliation = require('../models/PaymentReconciliation');
const ReconciliationService = require('../services/ReconciliationService');
const MockDataService = require('../utils/mockData');
const logger = require('../utils/logger');
const moment = require('moment');

// Middleware to validate date parameters
const validateDateRange = (req, res, next) => {
  const { fromDate, toDate } = req.query;
  
  if (!fromDate || !toDate) {
    return res.status(400).json({
      error: 'Missing required parameters',
      message: 'fromDate and toDate are required'
    });
  }
  
  const from = moment(fromDate);
  const to = moment(toDate);
  
  if (!from.isValid() || !to.isValid()) {
    return res.status(400).json({
      error: 'Invalid date format',
      message: 'Please use YYYY-MM-DD format for dates'
    });
  }
  
  if (from.isAfter(to)) {
    return res.status(400).json({
      error: 'Invalid date range',
      message: 'fromDate cannot be after toDate'
    });
  }
  
  // Limit to reasonable date ranges (max 90 days)
  if (to.diff(from, 'days') > 90) {
    return res.status(400).json({
      error: 'Date range too large',
      message: 'Maximum date range allowed is 90 days'
    });
  }
  
  req.dateRange = { from: from.toDate(), to: to.toDate() };
  next();
};

/**
 * GET /api/dashboard/summary
 * Get high-level reconciliation summary for dashboard
 */
router.get('/summary', validateDateRange, async (req, res) => {
  try {
    const { from, to } = req.dateRange;
    const { paymentMode } = req.query;
    
    logger.info(`Dashboard summary requested for ${from} to ${to}`);
    
    let summary;
    
    try {
      // Try to get real data from database
      summary = await PaymentReconciliation.getReconciliationSummary(from, to);
    } catch (dbError) {
      // If database fails, use mock data
      logger.warn('Database unavailable, using mock data:', dbError.message);
      summary = MockDataService.getMockReconciliationSummary(
        moment(from).format('YYYY-MM-DD'), 
        moment(to).format('YYYY-MM-DD')
      );
    }
    
    // Add additional metrics
    const variance = summary.corportalTotal - summary.ccbTotal;
    const reconciliationRate = summary.corportalTotal > 0 
      ? ((summary.corportalTotal - Math.abs(variance)) / summary.corportalTotal * 100).toFixed(2)
      : 0;
    
    const response = {
      ...summary,
      variance,
      reconciliationRate: parseFloat(reconciliationRate),
      lastUpdated: new Date().toISOString(),
      dateRange: { from, to },
      dataSource: summary.dataSource || 'mock' // Indicate if using mock data
    };
    
    res.json(response);
    
  } catch (error) {
    logger.error('Error fetching dashboard summary:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Unable to fetch dashboard summary'
    });
  }
});

/**
 * GET /api/dashboard/detailed-reconciliation
 * Get detailed reconciliation with matching and exceptions
 */
router.get('/detailed-reconciliation', validateDateRange, async (req, res) => {
  try {
    const { from, to } = req.dateRange;
    const options = {
      amountTolerance: parseFloat(req.query.amountTolerance) || 0.01,
      daysTolerance: parseInt(req.query.daysTolerance) || 2,
      includePartialMatches: req.query.includePartialMatches !== 'false'
    };
    
    logger.info(`Detailed reconciliation requested for ${from} to ${to}`);
    
    const reconciliation = await ReconciliationService.performDetailedReconciliation(from, to, options);
    
    res.json({
      ...reconciliation,
      options,
      dateRange: { from, to },
      lastUpdated: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Error performing detailed reconciliation:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Unable to perform detailed reconciliation'
    });
  }
});

/**
 * GET /api/dashboard/exceptions
 * Get payment exceptions requiring attention
 */
router.get('/exceptions', validateDateRange, async (req, res) => {
  try {
    const { from, to } = req.dateRange;
    const { severity, paymentMode, consumerID } = req.query;
    
    logger.info(`Exceptions requested for ${from} to ${to}`);
    
    let exceptions;
    
    try {
      exceptions = await PaymentReconciliation.getExceptions(from, to);
    } catch (dbError) {
      logger.warn('Database unavailable, using mock exceptions:', dbError.message);
      exceptions = MockDataService.getMockExceptions(
        moment(from).format('YYYY-MM-DD'), 
        moment(to).format('YYYY-MM-DD')
      );
    }
    
    // Apply filters
    if (paymentMode) {
      exceptions = exceptions.filter(exc => exc.paymentMode === paymentMode);
    }
    
    if (consumerID) {
      exceptions = exceptions.filter(exc => exc.consumerID === consumerID);
    }
    
    if (severity === 'critical') {
      exceptions = exceptions.filter(exc => exc.requiresAction);
    }
    
    // Sort by amount descending for priority
    exceptions.sort((a, b) => parseFloat(b.amount) - parseFloat(a.amount));
    
    res.json({
      exceptions,
      totalCount: exceptions.length,
      criticalCount: exceptions.filter(exc => exc.requiresAction).length,
      dateRange: { from, to },
      lastUpdated: new Date().toISOString(),
      dataSource: 'mock'
    });
    
  } catch (error) {
    logger.error('Error fetching exceptions:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Unable to fetch exceptions'
    });
  }
});

/**
 * GET /api/dashboard/payment-trends
 * Get payment trends and analytics
 */
router.get('/payment-trends', validateDateRange, async (req, res) => {
  try {
    const { from, to } = req.dateRange;
    
    logger.info(`Payment trends requested for ${from} to ${to}`);
    
    let trends;
    
    try {
      trends = await PaymentReconciliation.getPaymentTrends(from, to);
    } catch (dbError) {
      logger.warn('Database unavailable, using mock trends:', dbError.message);
      const mockTrends = MockDataService.getMockPaymentTrends(
        moment(from).format('YYYY-MM-DD'), 
        moment(to).format('YYYY-MM-DD')
      );
      trends = mockTrends;
    }
    
    // Process trends for better visualization
    const processedTrends = {
      daily: {},
      byPaymentMode: {},
      corportalVsCCB: []
    };
    
    // Group by day
    trends.corportalTrends.forEach(trend => {
      const day = moment(trend.PAYMENT_DAY).format('YYYY-MM-DD');
      if (!processedTrends.daily[day]) {
        processedTrends.daily[day] = { corportal: {}, ccb: {} };
      }
      processedTrends.daily[day].corportal[trend.PAYMENT_MODE] = {
        count: trend.TRANSACTION_COUNT,
        amount: parseFloat(trend.TOTAL_AMOUNT)
      };
    });
    
    trends.ccbTrends.forEach(trend => {
      const day = moment(trend.POSTING_DAY).format('YYYY-MM-DD');
      if (!processedTrends.daily[day]) {
        processedTrends.daily[day] = { corportal: {}, ccb: {} };
      }
      processedTrends.daily[day].ccb[trend.PAYMENT_MODE] = {
        count: trend.TRANSACTION_COUNT,
        amount: parseFloat(trend.TOTAL_AMOUNT)
      };
    });
    
    // Payment mode summary
    Object.values(PaymentReconciliation.PAYMENT_MODES).forEach(mode => {
      processedTrends.byPaymentMode[mode] = {
        corportal: { count: 0, amount: 0 },
        ccb: { count: 0, amount: 0 }
      };
    });
    
    trends.corportalTrends.forEach(trend => {
      processedTrends.byPaymentMode[trend.PAYMENT_MODE].corportal.count += trend.TRANSACTION_COUNT;
      processedTrends.byPaymentMode[trend.PAYMENT_MODE].corportal.amount += parseFloat(trend.TOTAL_AMOUNT);
    });
    
    trends.ccbTrends.forEach(trend => {
      processedTrends.byPaymentMode[trend.PAYMENT_MODE].ccb.count += trend.TRANSACTION_COUNT;
      processedTrends.byPaymentMode[trend.PAYMENT_MODE].ccb.amount += parseFloat(trend.TOTAL_AMOUNT);
    });
    
    // Daily comparison for charts
    const days = Object.keys(processedTrends.daily).sort();
    days.forEach(day => {
      const dayData = processedTrends.daily[day];
      const corportalTotal = Object.values(dayData.corportal)
        .reduce((sum, mode) => sum + mode.amount, 0);
      const ccbTotal = Object.values(dayData.ccb)
        .reduce((sum, mode) => sum + mode.amount, 0);
      
      processedTrends.corportalVsCCB.push({
        date: day,
        corportal: corportalTotal,
        ccb: ccbTotal,
        variance: corportalTotal - ccbTotal
      });
    });
    
    res.json({
      trends: processedTrends,
      raw: trends,
      dateRange: { from, to },
      lastUpdated: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Error fetching payment trends:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Unable to fetch payment trends'
    });
  }
});

/**
 * GET /api/dashboard/stats
 * Get reconciliation statistics and KPIs
 */
router.get('/stats', validateDateRange, async (req, res) => {
  try {
    const { from, to } = req.dateRange;
    
    logger.info(`Reconciliation stats requested for ${from} to ${to}`);
    
    let stats;
    
    try {
      stats = await ReconciliationService.getReconciliationStats(from, to);
    } catch (dbError) {
      logger.warn('Database unavailable, using mock stats:', dbError.message);
      const mockStats = MockDataService.getMockReconciliationStats(
        moment(from).format('YYYY-MM-DD'), 
        moment(to).format('YYYY-MM-DD')
      );
      stats = mockStats.kpis;
    }
    
    // Additional KPIs
    const kpis = {
      ...stats,
      totalVariance: stats.totalCorportalAmount - stats.totalCCBAmount,
      variancePercentage: stats.totalCorportalAmount > 0 
        ? ((stats.totalCorportalAmount - stats.totalCCBAmount) / stats.totalCorportalAmount * 100).toFixed(2)
        : 0,
      exceptionRate: ((stats.unmatchedCorportal + stats.unmatchedCCB) / 
        (stats.totalCorportalPayments + stats.totalCCBPayments) * 100).toFixed(2),
      dataQualityScore: (100 - parseFloat(((stats.unmatchedCorportal + stats.unmatchedCCB) / 
        (stats.totalCorportalPayments + stats.totalCCBPayments) * 100).toFixed(2))).toFixed(1)
    };
    
    res.json({
      kpis,
      dateRange: { from, to },
      lastUpdated: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Error fetching reconciliation stats:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Unable to fetch reconciliation statistics'
    });
  }
});

/**
 * GET /api/dashboard/payment-modes
 * Get payment modes configuration and statistics
 */
router.get('/payment-modes', (req, res) => {
  try {
    const paymentModes = Object.entries(PaymentReconciliation.PAYMENT_MODES).map(([key, value]) => ({
      key,
      value,
      displayName: key.split('_').map(word => 
        word.charAt(0) + word.slice(1).toLowerCase()
      ).join(' '),
      settlementPeriod: value === 'BANK_COUNTER' ? 'T+0' : 'T+1'
    }));
    
    res.json({
      paymentModes,
      settlementPeriods: PaymentReconciliation.SETTLEMENT_PERIODS,
      reconciliationStatuses: PaymentReconciliation.RECONCILIATION_STATUS
    });
    
  } catch (error) {
    logger.error('Error fetching payment modes:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Unable to fetch payment modes'
    });
  }
});

module.exports = router;