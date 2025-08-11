const ExcelJS = require('exceljs');
const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');
const moment = require('moment');

class ExportService {
  
  /**
   * Export reconciliation summary to Excel format
   * @param {Object} summaryData 
   * @param {String} fromDate 
   * @param {String} toDate 
   * @returns {Buffer} Excel file buffer
   */
  static async exportSummaryToExcel(summaryData, fromDate, toDate) {
    try {
      const workbook = new ExcelJS.Workbook();
      
      // Summary Sheet
      const summarySheet = workbook.addWorksheet('Reconciliation Summary');
      
      // Header information
      summarySheet.addRow(['KPDCL Payment Reconciliation Report']);
      summarySheet.addRow(['Report Period:', `${fromDate} to ${toDate}`]);
      summarySheet.addRow(['Generated On:', moment().format('YYYY-MM-DD HH:mm:ss')]);
      summarySheet.addRow([]); // Empty row
      
      // Overall Summary
      summarySheet.addRow(['Overall Summary']);
      summarySheet.addRow(['Metric', 'CORPORTAL', 'CCB', 'Variance']);
      summarySheet.addRow([
        'Total Amount', 
        summaryData.corportalTotal, 
        summaryData.ccbTotal, 
        summaryData.variance
      ]);
      summarySheet.addRow([
        'Transaction Count', 
        summaryData.corportalCount, 
        summaryData.ccbCount, 
        summaryData.corportalCount - summaryData.ccbCount
      ]);
      summarySheet.addRow([
        'Matched Count', 
        summaryData.matchedCount, 
        '-', 
        '-'
      ]);
      summarySheet.addRow([
        'Reconciliation Rate', 
        `${summaryData.reconciliationRate}%`, 
        '-', 
        '-'
      ]);
      
      summarySheet.addRow([]); // Empty row
      
      // Payment Mode Breakdown
      summarySheet.addRow(['Payment Mode Breakdown']);
      summarySheet.addRow([
        'Payment Mode', 
        'CORPORTAL Amount', 
        'CCB Amount', 
        'Variance',
        'CORPORTAL Count',
        'CCB Count'
      ]);
      
      Object.entries(summaryData.byPaymentMode || {}).forEach(([mode, data]) => {
        summarySheet.addRow([
          mode,
          data.corportalAmount,
          data.ccbAmount,
          data.variance,
          data.corportalCount,
          data.ccbCount
        ]);
      });
      
      // Style the header rows
      summarySheet.getRow(1).font = { bold: true, size: 16 };
      summarySheet.getRow(5).font = { bold: true, size: 14 };
      summarySheet.getRow(6).font = { bold: true };
      summarySheet.getRow(12).font = { bold: true, size: 14 };
      summarySheet.getRow(13).font = { bold: true };
      
      // Auto-fit columns
      summarySheet.columns.forEach(column => {
        column.width = 20;
      });
      
      return await workbook.xlsx.writeBuffer();
      
    } catch (error) {
      logger.error('Error exporting summary to Excel:', error);
      throw error;
    }
  }

  /**
   * Export exceptions to Excel format
   * @param {Array} exceptions 
   * @param {String} fromDate 
   * @param {String} toDate 
   * @returns {Buffer} Excel file buffer
   */
  static async exportExceptionsToExcel(exceptions, fromDate, toDate) {
    try {
      const workbook = new ExcelJS.Workbook();
      const exceptionsSheet = workbook.addWorksheet('Payment Exceptions');
      
      // Header information
      exceptionsSheet.addRow(['KPDCL Payment Exceptions Report']);
      exceptionsSheet.addRow(['Report Period:', `${fromDate} to ${toDate}`]);
      exceptionsSheet.addRow(['Generated On:', moment().format('YYYY-MM-DD HH:mm:ss')]);
      exceptionsSheet.addRow(['Total Exceptions:', exceptions.length]);
      exceptionsSheet.addRow([]); // Empty row
      
      // Exception headers
      exceptionsSheet.addRow([
        'Exception Type',
        'Consumer ID',
        'Payment Mode',
        'Amount',
        'Transaction ID',
        'Payment Date',
        'Description',
        'Days Since Payment',
        'Requires Action'
      ]);
      
      // Exception data
      exceptions.forEach(exception => {
        exceptionsSheet.addRow([
          exception.type,
          exception.consumerID,
          exception.paymentMode,
          exception.amount,
          exception.transactionID,
          moment(exception.paymentDate).format('YYYY-MM-DD'),
          exception.description,
          exception.daysSincePayment || 0,
          exception.requiresAction ? 'Yes' : 'No'
        ]);
      });
      
      // Style headers
      exceptionsSheet.getRow(1).font = { bold: true, size: 16 };
      exceptionsSheet.getRow(6).font = { bold: true };
      
      // Color code exception types
      for (let i = 7; i <= 6 + exceptions.length; i++) {
        const row = exceptionsSheet.getRow(i);
        const exceptionType = row.getCell(1).value;
        
        switch (exceptionType) {
          case 'UNMATCHED_CORPORTAL':
            row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE6CC' } };
            break;
          case 'UNMATCHED_CCB':
            row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE6E6' } };
            break;
          case 'AMOUNT_MISMATCH':
            row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFCCCC' } };
            break;
        }
      }
      
      // Auto-fit columns
      exceptionsSheet.columns.forEach(column => {
        column.width = 18;
      });
      
      return await workbook.xlsx.writeBuffer();
      
    } catch (error) {
      logger.error('Error exporting exceptions to Excel:', error);
      throw error;
    }
  }

  /**
   * Export detailed reconciliation to Excel format
   * @param {Object} reconciliationData 
   * @param {String} fromDate 
   * @param {String} toDate 
   * @returns {Buffer} Excel file buffer
   */
  static async exportDetailedReconciliationToExcel(reconciliationData, fromDate, toDate) {
    try {
      const workbook = new ExcelJS.Workbook();
      
      // Summary Sheet
      const summarySheet = workbook.addWorksheet('Summary');
      summarySheet.addRow(['Detailed Reconciliation Report']);
      summarySheet.addRow(['Report Period:', `${fromDate} to ${toDate}`]);
      summarySheet.addRow(['Generated On:', moment().format('YYYY-MM-DD HH:mm:ss')]);
      summarySheet.addRow([]); // Empty row
      
      // Summary statistics
      const summary = reconciliationData.summary;
      summarySheet.addRow(['Summary Statistics']);
      summarySheet.addRow(['Total CORPORTAL Payments', summary.totalCorportalPayments]);
      summarySheet.addRow(['Total CCB Payments', summary.totalCCBPayments]);
      summarySheet.addRow(['Matched Payments', summary.matchedPayments]);
      summarySheet.addRow(['Unmatched CORPORTAL', summary.unmatchedCorportal]);
      summarySheet.addRow(['Unmatched CCB', summary.unmatchedCCB]);
      summarySheet.addRow(['Partial Matches', summary.partialMatches]);
      
      // Matches Sheet
      if (reconciliationData.matches && reconciliationData.matches.length > 0) {
        const matchesSheet = workbook.addWorksheet('Matched Payments');
        matchesSheet.addRow([
          'Match Type',
          'Consumer ID',
          'Payment Mode',
          'Amount',
          'CORPORTAL Date',
          'CCB Date',
          'Match Score',
          'Date Difference'
        ]);
        
        reconciliationData.matches.forEach(match => {
          matchesSheet.addRow([
            match.type,
            match.corportalPayment.CONSUMER_ID,
            match.corportalPayment.PAYMENT_MODE,
            match.corportalPayment.AMOUNT,
            moment(match.corportalPayment.PAYMENT_DATE).format('YYYY-MM-DD'),
            moment(match.ccbPayment.POSTING_DATE).format('YYYY-MM-DD'),
            match.matchScore,
            match.dateDifference
          ]);
        });
        
        matchesSheet.getRow(1).font = { bold: true };
      }
      
      // Exceptions Sheet
      if (reconciliationData.exceptions && reconciliationData.exceptions.length > 0) {
        const exceptionsSheet = workbook.addWorksheet('Exceptions');
        exceptionsSheet.addRow([
          'Exception Type',
          'Consumer ID',
          'Payment Mode',
          'Amount',
          'Payment Date',
          'Requires Action',
          'Days Since Payment'
        ]);
        
        reconciliationData.exceptions.forEach(exception => {
          const payment = exception.payment;
          exceptionsSheet.addRow([
            exception.type,
            payment.CONSUMER_ID || payment.CONSUMER_NO,
            payment.PAYMENT_MODE,
            payment.AMOUNT || payment.PAID_AMOUNT,
            moment(payment.PAYMENT_DATE || payment.POSTING_DATE).format('YYYY-MM-DD'),
            exception.requiresAction ? 'Yes' : 'No',
            exception.daysSincePayment || exception.daysSincePosting || 0
          ]);
        });
        
        exceptionsSheet.getRow(1).font = { bold: true };
      }
      
      // Style all worksheets
      workbook.worksheets.forEach(sheet => {
        sheet.columns.forEach(column => {
          column.width = 18;
        });
      });
      
      return await workbook.xlsx.writeBuffer();
      
    } catch (error) {
      logger.error('Error exporting detailed reconciliation to Excel:', error);
      throw error;
    }
  }

  /**
   * Export data to CSV format
   * @param {Array} data 
   * @param {Array} headers 
   * @returns {String} CSV content
   */
  static exportToCSV(data, headers) {
    try {
      let csvContent = headers.join(',') + '\n';
      
      data.forEach(row => {
        const csvRow = headers.map(header => {
          let value = row[header] || '';
          
          // Handle dates
          if (value instanceof Date) {
            value = moment(value).format('YYYY-MM-DD');
          }
          
          // Handle strings with commas
          if (typeof value === 'string' && value.includes(',')) {
            value = `"${value}"`;
          }
          
          return value;
        });
        
        csvContent += csvRow.join(',') + '\n';
      });
      
      return csvContent;
      
    } catch (error) {
      logger.error('Error exporting to CSV:', error);
      throw error;
    }
  }

  /**
   * Generate automated report
   * @param {Object} reconciliationData 
   * @param {String} fromDate 
   * @param {String} toDate 
   * @returns {Object} Report data
   */
  static generateAutomatedReport(reconciliationData, fromDate, toDate) {
    try {
      const summary = reconciliationData.summary;
      const totalPayments = summary.totalCorportalPayments + summary.totalCCBPayments;
      const matchRate = totalPayments > 0 ? (summary.matchedPayments / totalPayments * 100).toFixed(2) : 0;
      
      const report = {
        reportHeader: {
          title: 'KPDCL Payment Reconciliation Report',
          period: `${fromDate} to ${toDate}`,
          generatedOn: moment().format('YYYY-MM-DD HH:mm:ss'),
          version: '1.0'
        },
        
        executiveSummary: {
          totalPaymentsProcessed: totalPayments,
          totalAmountReconciled: summary.totalCorportalAmount,
          matchingEfficiency: `${matchRate}%`,
          criticalExceptions: reconciliationData.exceptions.filter(e => e.requiresAction).length,
          dataQualityScore: matchRate > 95 ? 'Excellent' : matchRate > 90 ? 'Good' : 'Needs Improvement'
        },
        
        keyFindings: {
          totalMatches: summary.matchedPayments,
          unmatchedCorportal: summary.unmatchedCorportal,
          unmatchedCCB: summary.unmatchedCCB,
          partialMatches: summary.partialMatches,
          averageSettlementTime: this.calculateAverageSettlementTime(reconciliationData.matches)
        },
        
        recommendations: this.generateRecommendations(reconciliationData),
        
        nextActions: this.generateNextActions(reconciliationData.exceptions)
      };
      
      return report;
      
    } catch (error) {
      logger.error('Error generating automated report:', error);
      throw error;
    }
  }

  /**
   * Calculate average settlement time from matches
   */
  static calculateAverageSettlementTime(matches) {
    if (!matches || matches.length === 0) return '0 days';
    
    const totalDays = matches.reduce((sum, match) => sum + Math.abs(match.dateDifference), 0);
    const avgDays = (totalDays / matches.length).toFixed(1);
    
    return `${avgDays} days`;
  }

  /**
   * Generate recommendations based on reconciliation results
   */
  static generateRecommendations(reconciliationData) {
    const recommendations = [];
    const summary = reconciliationData.summary;
    
    if (summary.unmatchedCorportal > 0) {
      recommendations.push(
        `Review ${summary.unmatchedCorportal} unmatched CORPORTAL payments for potential posting delays`
      );
    }
    
    if (summary.unmatchedCCB > 0) {
      recommendations.push(
        `Investigate ${summary.unmatchedCCB} CCB payments without corresponding CORPORTAL records`
      );
    }
    
    if (summary.partialMatches > 0) {
      recommendations.push(
        `Verify ${summary.partialMatches} partial matches for accuracy and completeness`
      );
    }
    
    const totalPayments = summary.totalCorportalPayments + summary.totalCCBPayments;
    const matchRate = totalPayments > 0 ? (summary.matchedPayments / totalPayments * 100) : 0;
    
    if (matchRate < 95) {
      recommendations.push(
        'Implement additional data validation checks to improve reconciliation accuracy'
      );
    }
    
    return recommendations;
  }

  /**
   * Generate next actions based on exceptions
   */
  static generateNextActions(exceptions) {
    const actions = [];
    
    const criticalExceptions = exceptions.filter(e => e.requiresAction);
    if (criticalExceptions.length > 0) {
      actions.push(`Immediate: Review ${criticalExceptions.length} critical exceptions requiring action`);
    }
    
    const oldExceptions = exceptions.filter(e => e.daysSincePayment > 5);
    if (oldExceptions.length > 0) {
      actions.push(`Priority: Investigate ${oldExceptions.length} payments older than 5 days`);
    }
    
    actions.push('Routine: Schedule next reconciliation run for tomorrow');
    actions.push('Follow-up: Verify resolution of previously identified exceptions');
    
    return actions;
  }
}

module.exports = ExportService;