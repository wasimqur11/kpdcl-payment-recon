const dbManager = require('../config/database');
const logger = require('../utils/logger');

/**
 * Database initialization script
 * This script tests database connections and provides sample data structure
 */

async function initializeDatabase() {
  try {
    logger.info('Starting database initialization...');
    
    // Initialize connection pools
    await dbManager.initializePools();
    logger.info('Database pools initialized successfully');
    
    // Test connections
    const testResults = await dbManager.testConnections();
    logger.info('Database connection test results:', testResults);
    
    // Check for required tables
    await checkRequiredTables();
    
    // Provide sample queries for table creation
    await provideSampleQueries();
    
    logger.info('Database initialization completed successfully');
    
  } catch (error) {
    logger.error('Database initialization failed:', error);
    process.exit(1);
  } finally {
    await dbManager.closePools();
    process.exit(0);
  }
}

async function checkRequiredTables() {
  try {
    // Check CORPORTAL_PAYMENTS table
    const corportalTableCheck = `
      SELECT COUNT(*) as TABLE_COUNT 
      FROM USER_TABLES 
      WHERE TABLE_NAME = 'CORPORTAL_PAYMENTS'
    `;
    
    const corportalResult = await dbManager.executeCorportalQuery(corportalTableCheck);
    if (corportalResult[0].TABLE_COUNT === 0) {
      logger.warn('CORPORTAL_PAYMENTS table not found. Please create it using the sample DDL.');
    } else {
      logger.info('CORPORTAL_PAYMENTS table exists');
    }
    
    // Check CCB_PAYMENTS table
    const ccbTableCheck = `
      SELECT COUNT(*) as TABLE_COUNT 
      FROM USER_TABLES 
      WHERE TABLE_NAME = 'CCB_PAYMENTS'
    `;
    
    const ccbResult = await dbManager.executeCCBQuery(ccbTableCheck);
    if (ccbResult[0].TABLE_COUNT === 0) {
      logger.warn('CCB_PAYMENTS table not found. Please create it using the sample DDL.');
    } else {
      logger.info('CCB_PAYMENTS table exists');
    }
    
  } catch (error) {
    logger.warn('Could not check table existence:', error.message);
  }
}

async function provideSampleQueries() {
  logger.info('\n=== SAMPLE TABLE CREATION QUERIES ===\n');
  
  const corportalTableDDL = `
-- CORPORTAL_PAYMENTS table (for CORPORTAL database)
CREATE TABLE CORPORTAL_PAYMENTS (
  CONSUMER_ID VARCHAR2(20) NOT NULL,
  PAYMENT_MODE VARCHAR2(50) NOT NULL,
  AMOUNT NUMBER(15,2) NOT NULL,
  TRANSACTION_ID VARCHAR2(100) PRIMARY KEY,
  PAYMENT_DATE DATE NOT NULL,
  BANK_REF_NUMBER VARCHAR2(100),
  STATUS VARCHAR2(20) DEFAULT 'SUCCESS',
  CREATED_DATE DATE DEFAULT SYSDATE
);

-- Indexes for performance
CREATE INDEX IDX_CORPORTAL_CONSUMER_DATE ON CORPORTAL_PAYMENTS(CONSUMER_ID, PAYMENT_DATE);
CREATE INDEX IDX_CORPORTAL_MODE_DATE ON CORPORTAL_PAYMENTS(PAYMENT_MODE, PAYMENT_DATE);
CREATE INDEX IDX_CORPORTAL_AMOUNT ON CORPORTAL_PAYMENTS(AMOUNT);
  `;
  
  const ccbTableDDL = `
-- CCB_PAYMENTS table (for CCB database)
CREATE TABLE CCB_PAYMENTS (
  CONSUMER_NO VARCHAR2(20) NOT NULL,
  PAYMENT_MODE VARCHAR2(50) NOT NULL,
  PAID_AMOUNT NUMBER(15,2) NOT NULL,
  TRANSACTION_REF VARCHAR2(100) PRIMARY KEY,
  PAYMENT_DATE DATE NOT NULL,
  POSTING_DATE DATE NOT NULL,
  PAYMENT_STATUS VARCHAR2(20) DEFAULT 'POSTED',
  CREATED_DATE DATE DEFAULT SYSDATE
);

-- Indexes for performance
CREATE INDEX IDX_CCB_CONSUMER_DATE ON CCB_PAYMENTS(CONSUMER_NO, POSTING_DATE);
CREATE INDEX IDX_CCB_MODE_DATE ON CCB_PAYMENTS(PAYMENT_MODE, POSTING_DATE);
CREATE INDEX IDX_CCB_AMOUNT ON CCB_PAYMENTS(PAID_AMOUNT);
  `;
  
  const sampleDataInserts = `
-- Sample data for testing
-- CORPORTAL_PAYMENTS sample data
INSERT INTO CORPORTAL_PAYMENTS VALUES ('CON001', 'BANK_COUNTER', 1000.00, 'TXN001', SYSDATE-1, 'BANK001', 'SUCCESS', SYSDATE-1);
INSERT INTO CORPORTAL_PAYMENTS VALUES ('CON002', 'BILLSAHULIYAT_PLUS', 1500.00, 'TXN002', SYSDATE-1, 'APP001', 'SUCCESS', SYSDATE-1);
INSERT INTO CORPORTAL_PAYMENTS VALUES ('CON003', 'JK_BANK_MPAY', 2000.00, 'TXN003', SYSDATE-2, 'MPAY001', 'SUCCESS', SYSDATE-2);

-- CCB_PAYMENTS sample data
INSERT INTO CCB_PAYMENTS VALUES ('CON001', 'BANK_COUNTER', 1000.00, 'TXN001', SYSDATE-1, SYSDATE, 'POSTED', SYSDATE);
INSERT INTO CCB_PAYMENTS VALUES ('CON002', 'BILLSAHULIYAT_PLUS', 1500.00, 'TXN002', SYSDATE-1, SYSDATE, 'POSTED', SYSDATE);
-- Note: CON003 payment not posted yet (for testing exceptions)

COMMIT;
  `;
  
  logger.info('CORPORTAL TABLE DDL:');
  logger.info(corportalTableDDL);
  
  logger.info('\nCCB TABLE DDL:');
  logger.info(ccbTableDDL);
  
  logger.info('\nSAMPLE DATA:');
  logger.info(sampleDataInserts);
  
  logger.info('\n=== CONFIGURATION CHECKLIST ===');
  logger.info('1. Create the above tables in respective databases');
  logger.info('2. Grant appropriate permissions to application user');
  logger.info('3. Insert sample data for testing');
  logger.info('4. Configure environment variables in .env file');
  logger.info('5. Test the application with sample data');
}

// Performance monitoring queries
async function provideSampleMonitoringQueries() {
  const monitoringQueries = `
-- Performance monitoring queries

-- 1. Check payment volume by date
SELECT 
  TRUNC(PAYMENT_DATE) as PAYMENT_DAY,
  PAYMENT_MODE,
  COUNT(*) as TRANSACTION_COUNT,
  SUM(AMOUNT) as TOTAL_AMOUNT
FROM CORPORTAL_PAYMENTS 
WHERE PAYMENT_DATE >= SYSDATE - 30
GROUP BY TRUNC(PAYMENT_DATE), PAYMENT_MODE
ORDER BY PAYMENT_DAY DESC;

-- 2. Find unmatched payments
SELECT 
  c.CONSUMER_ID,
  c.PAYMENT_MODE,
  c.AMOUNT,
  c.TRANSACTION_ID,
  c.PAYMENT_DATE
FROM CORPORTAL_PAYMENTS c
LEFT JOIN CCB_PAYMENTS p ON (
  c.CONSUMER_ID = p.CONSUMER_NO AND
  c.AMOUNT = p.PAID_AMOUNT AND
  c.PAYMENT_MODE = p.PAYMENT_MODE
)
WHERE p.CONSUMER_NO IS NULL
AND c.PAYMENT_DATE >= SYSDATE - 7;

-- 3. Settlement delay analysis
SELECT 
  c.CONSUMER_ID,
  c.PAYMENT_MODE,
  c.PAYMENT_DATE,
  p.POSTING_DATE,
  (p.POSTING_DATE - c.PAYMENT_DATE) as SETTLEMENT_DAYS
FROM CORPORTAL_PAYMENTS c
JOIN CCB_PAYMENTS p ON (
  c.CONSUMER_ID = p.CONSUMER_NO AND
  c.AMOUNT = p.PAID_AMOUNT AND
  c.PAYMENT_MODE = p.PAYMENT_MODE
)
WHERE (p.POSTING_DATE - c.PAYMENT_DATE) > 2
ORDER BY SETTLEMENT_DAYS DESC;
  `;
  
  logger.info('\nMONITORING QUERIES:');
  logger.info(monitoringQueries);
}

// Run initialization
if (require.main === module) {
  initializeDatabase();
}

module.exports = { initializeDatabase, checkRequiredTables };