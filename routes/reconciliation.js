const express = require('express');
const router = express.Router();
const PaymentReconciliation = require('../models/PaymentReconciliation');
const ReconciliationService = require('../services/ReconciliationService');
const logger = require('../utils/logger');
const moment = require('moment');

/**
 * POST /api/reconciliation/run
 * Trigger manual reconciliation for a specific date range
 */
router.post('/run', async (req, res) => {
  try {
    const { fromDate, toDate, options = {} } = req.body;
    
    if (!fromDate || !toDate) {
      return res.status(400).json({
        error: 'Missing parameters',
        message: 'fromDate and toDate are required'
      });
    }
    
    const from = moment(fromDate).toDate();
    const to = moment(toDate).toDate();
    
    logger.info(`Manual reconciliation triggered for ${fromDate} to ${toDate}`);
    
    const reconciliationResult = await ReconciliationService.performDetailedReconciliation(
      from, 
      to, 
      options
    );
    
    res.json({
      success: true,
      message: 'Reconciliation completed successfully',
      result: reconciliationResult,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Manual reconciliation failed:', error);
    res.status(500).json({
      error: 'Reconciliation Failed',
      message: error.message
    });
  }
});

/**
 * GET /api/reconciliation/corportal-payments
 * Get payments from CORPORTAL database with filtering
 */
router.get('/corportal-payments', async (req, res) => {
  try {
    const { 
      fromDate, 
      toDate, 
      paymentMode, 
      consumerID, 
      limit = 100, 
      offset = 0 
    } = req.query;
    
    if (!fromDate || !toDate) {
      return res.status(400).json({
        error: 'Missing parameters',
        message: 'fromDate and toDate are required'
      });
    }
    
    const from = moment(fromDate).toDate();
    const to = moment(toDate).toDate();
    
    let payments = await PaymentReconciliation.getCorportalPayments(from, to, paymentMode);
    
    // Filter by consumer ID if provided
    if (consumerID) {
      payments = payments.filter(p => p.CONSUMER_ID === consumerID);
    }
    
    // Apply pagination
    const total = payments.length;
    const paginatedPayments = payments.slice(
      parseInt(offset), 
      parseInt(offset) + parseInt(limit)
    );
    
    res.json({
      payments: paginatedPayments,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + parseInt(limit) < total
      },
      filters: { fromDate, toDate, paymentMode, consumerID }
    });
    
  } catch (error) {
    logger.error('Error fetching CORPORTAL payments:', error);
    res.status(500).json({
      error: 'Database Error',
      message: 'Unable to fetch CORPORTAL payments'
    });
  }
});

/**
 * GET /api/reconciliation/ccb-payments
 * Get payments from CCB database with filtering
 */
router.get('/ccb-payments', async (req, res) => {
  try {
    const { 
      fromDate, 
      toDate, 
      paymentMode, 
      consumerID, 
      limit = 100, 
      offset = 0 
    } = req.query;
    
    if (!fromDate || !toDate) {
      return res.status(400).json({
        error: 'Missing parameters',
        message: 'fromDate and toDate are required'
      });
    }
    
    const from = moment(fromDate).toDate();
    const to = moment(toDate).toDate();
    
    let payments = await PaymentReconciliation.getCCBPayments(from, to, paymentMode);
    
    // Filter by consumer ID if provided
    if (consumerID) {
      payments = payments.filter(p => p.CONSUMER_ID === consumerID);
    }
    
    // Apply pagination
    const total = payments.length;
    const paginatedPayments = payments.slice(
      parseInt(offset), 
      parseInt(offset) + parseInt(limit)
    );
    
    res.json({
      payments: paginatedPayments,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + parseInt(limit) < total
      },
      filters: { fromDate, toDate, paymentMode, consumerID }
    });
    
  } catch (error) {
    logger.error('Error fetching CCB payments:', error);
    res.status(500).json({
      error: 'Database Error',
      message: 'Unable to fetch CCB payments'
    });
  }
});

/**
 * GET /api/reconciliation/match-details/:consumerID
 * Get detailed matching information for a specific consumer
 */
router.get('/match-details/:consumerID', async (req, res) => {
  try {
    const { consumerID } = req.params;
    const { fromDate, toDate } = req.query;
    
    if (!fromDate || !toDate) {
      return res.status(400).json({
        error: 'Missing parameters',
        message: 'fromDate and toDate are required'
      });
    }
    
    const from = moment(fromDate).toDate();
    const to = moment(toDate).toDate();
    
    // Get payments for specific consumer from both databases
    const [corportalPayments, ccbPayments] = await Promise.all([
      PaymentReconciliation.getCorportalPayments(from, to).then(payments => 
        payments.filter(p => p.CONSUMER_ID === consumerID)
      ),
      PaymentReconciliation.getCCBPayments(from, to).then(payments => 
        payments.filter(p => p.CONSUMER_ID === consumerID)
      )
    ]);
    
    // Perform detailed matching for this consumer
    const matchDetails = {
      consumerID,
      corportalPayments: corportalPayments.map(p => ({
        ...p,
        matched: false,
        matchedWith: null
      })),
      ccbPayments: ccbPayments.map(p => ({
        ...p,
        matched: false,
        matchedWith: null
      })),
      exactMatches: [],
      potentialMatches: [],
      unmatchedCorportal: [],
      unmatchedCCB: []
    };
    
    // Simple matching logic for consumer-specific view
    corportalPayments.forEach(corpPayment => {
      const exactMatch = ccbPayments.find(ccbPayment => 
        ccbPayment.AMOUNT === corpPayment.AMOUNT &&
        ccbPayment.PAYMENT_MODE === corpPayment.PAYMENT_MODE &&
        Math.abs(moment(ccbPayment.POSTING_DATE).diff(moment(corpPayment.PAYMENT_DATE), 'days')) <= 2
      );
      
      if (exactMatch) {
        matchDetails.exactMatches.push({
          corportalPayment: corpPayment,
          ccbPayment: exactMatch,
          matchType: 'EXACT',
          confidence: 100
        });
        
        // Mark as matched
        const corpIndex = matchDetails.corportalPayments.findIndex(p => p.TRANSACTION_ID === corpPayment.TRANSACTION_ID);
        const ccbIndex = matchDetails.ccbPayments.findIndex(p => p.TRANSACTION_REF === exactMatch.TRANSACTION_REF);
        
        if (corpIndex !== -1) matchDetails.corportalPayments[corpIndex].matched = true;
        if (ccbIndex !== -1) matchDetails.ccbPayments[ccbIndex].matched = true;
      }
    });
    
    // Find unmatched payments
    matchDetails.unmatchedCorportal = matchDetails.corportalPayments.filter(p => !p.matched);
    matchDetails.unmatchedCCB = matchDetails.ccbPayments.filter(p => !p.matched);
    
    res.json({
      matchDetails,
      summary: {
        totalCorportalPayments: corportalPayments.length,
        totalCCBPayments: ccbPayments.length,
        exactMatches: matchDetails.exactMatches.length,
        unmatchedCorportal: matchDetails.unmatchedCorportal.length,
        unmatchedCCB: matchDetails.unmatchedCCB.length
      }
    });
    
  } catch (error) {
    logger.error('Error fetching match details:', error);
    res.status(500).json({
      error: 'Database Error',
      message: 'Unable to fetch match details'
    });
  }
});

/**
 * POST /api/reconciliation/manual-match
 * Manually mark payments as matched
 */
router.post('/manual-match', async (req, res) => {
  try {
    const { corportalPaymentId, ccbPaymentId, reason } = req.body;
    
    if (!corportalPaymentId || !ccbPaymentId) {
      return res.status(400).json({
        error: 'Missing parameters',
        message: 'corportalPaymentId and ccbPaymentId are required'
      });
    }
    
    // In a real implementation, you would store this manual matching in a separate table
    // For now, we'll just log it and return success
    logger.info(`Manual match created: CORPORTAL ${corportalPaymentId} <-> CCB ${ccbPaymentId}. Reason: ${reason}`);
    
    res.json({
      success: true,
      message: 'Manual match recorded successfully',
      match: {
        corportalPaymentId,
        ccbPaymentId,
        reason,
        matchedBy: 'system', // In real app, this would be the user ID
        matchedAt: new Date().toISOString()
      }
    });
    
  } catch (error) {
    logger.error('Error creating manual match:', error);
    res.status(500).json({
      error: 'Database Error',
      message: 'Unable to create manual match'
    });
  }
});

/**
 * GET /api/reconciliation/export
 * Export reconciliation results to CSV/Excel
 */
router.get('/export', async (req, res) => {
  try {
    const { fromDate, toDate, format = 'excel', type = 'summary' } = req.query;
    
    if (!fromDate || !toDate) {
      return res.status(400).json({
        error: 'Missing parameters',
        message: 'fromDate and toDate are required'
      });
    }
    
    const from = moment(fromDate).toDate();
    const to = moment(toDate).toDate();
    
    let data;
    let filename;
    let buffer;
    let contentType;
    
    const ExportService = require('../utils/exportService');
    
    switch (type) {
      case 'summary':
        data = await PaymentReconciliation.getReconciliationSummary(from, to);
        filename = `reconciliation-summary-${fromDate}-to-${toDate}`;
        
        if (format === 'excel') {
          buffer = await ExportService.exportSummaryToExcel(data, fromDate, toDate);
          contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
          filename += '.xlsx';
        } else {
          // CSV format for summary (simplified)
          const csvHeaders = ['Metric', 'CORPORTAL', 'CCB', 'Variance'];
          const csvData = [
            { Metric: 'Total Amount', CORPORTAL: data.corportalTotal, CCB: data.ccbTotal, Variance: data.variance },
            { Metric: 'Transaction Count', CORPORTAL: data.corportalCount, CCB: data.ccbCount, Variance: data.corportalCount - data.ccbCount }
          ];
          buffer = Buffer.from(ExportService.exportToCSV(csvData, csvHeaders), 'utf8');
          contentType = 'text/csv';
          filename += '.csv';
        }
        break;
        
      case 'exceptions':
        data = await PaymentReconciliation.getExceptions(from, to);
        filename = `reconciliation-exceptions-${fromDate}-to-${toDate}`;
        
        if (format === 'excel') {
          buffer = await ExportService.exportExceptionsToExcel(data, fromDate, toDate);
          contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
          filename += '.xlsx';
        } else {
          const csvHeaders = ['Exception Type', 'Consumer ID', 'Payment Mode', 'Amount', 'Transaction ID', 'Payment Date', 'Description'];
          buffer = Buffer.from(ExportService.exportToCSV(data, csvHeaders), 'utf8');
          contentType = 'text/csv';
          filename += '.csv';
        }
        break;
        
      case 'detailed':
        data = await ReconciliationService.performDetailedReconciliation(from, to);
        filename = `detailed-reconciliation-${fromDate}-to-${toDate}`;
        
        if (format === 'excel') {
          buffer = await ExportService.exportDetailedReconciliationToExcel(data, fromDate, toDate);
          contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
          filename += '.xlsx';
        } else {
          // For detailed reconciliation, export matches as CSV
          const csvHeaders = ['Consumer ID', 'Payment Mode', 'Amount', 'Match Type', 'Match Score'];
          const csvData = data.matches.map(match => ({
            'Consumer ID': match.corportalPayment.CONSUMER_ID,
            'Payment Mode': match.corportalPayment.PAYMENT_MODE,
            'Amount': match.corportalPayment.AMOUNT,
            'Match Type': match.type,
            'Match Score': match.matchScore
          }));
          buffer = Buffer.from(ExportService.exportToCSV(csvData, csvHeaders), 'utf8');
          contentType = 'text/csv';
          filename += '.csv';
        }
        break;
        
      default:
        return res.status(400).json({
          error: 'Invalid export type',
          message: 'Type must be one of: summary, exceptions, detailed'
        });
    }
    
    // Set appropriate headers for file download
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    
    res.send(buffer);
    
    logger.info(`Export completed: ${type} - ${format} - ${filename}`);
    
  } catch (error) {
    logger.error('Error exporting reconciliation data:', error);
    res.status(500).json({
      error: 'Export Error',
      message: 'Unable to export reconciliation data'
    });
  }
});

module.exports = router;