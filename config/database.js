const oracledb = require('oracledb');
const logger = require('../utils/logger');

// Oracle client initialization
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
oracledb.autoCommit = true;

class DatabaseManager {
  constructor() {
    this.corportalPool = null;
    this.ccbPool = null;
  }

  async initializePools() {
    try {
      // CORPORTAL Database Pool
      this.corportalPool = await oracledb.createPool({
        user: process.env.CORPORTAL_DB_USER,
        password: process.env.CORPORTAL_DB_PASSWORD,
        connectString: `${process.env.CORPORTAL_DB_HOST}:${process.env.CORPORTAL_DB_PORT}/${process.env.CORPORTAL_DB_SERVICE}`,
        poolMin: 2,
        poolMax: 10,
        poolIncrement: 1,
        poolTimeout: 300,
        stmtCacheSize: 30
      });
      
      logger.info('CORPORTAL database pool created successfully');

      // CCB Database Pool
      this.ccbPool = await oracledb.createPool({
        user: process.env.CCB_DB_USER,
        password: process.env.CCB_DB_PASSWORD,
        connectString: `${process.env.CCB_DB_HOST}:${process.env.CCB_DB_PORT}/${process.env.CCB_DB_SERVICE}`,
        poolMin: 2,
        poolMax: 10,
        poolIncrement: 1,
        poolTimeout: 300,
        stmtCacheSize: 30
      });
      
      logger.info('CCB database pool created successfully');
      
    } catch (error) {
      logger.error('Database pool initialization failed:', error);
      throw error;
    }
  }

  async getCorportalConnection() {
    if (!this.corportalPool) {
      throw new Error('CORPORTAL database pool not initialized');
    }
    return await this.corportalPool.getConnection();
  }

  async getCCBConnection() {
    if (!this.ccbPool) {
      throw new Error('CCB database pool not initialized');
    }
    return await this.ccbPool.getConnection();
  }

  async executeQuery(pool, query, params = []) {
    let connection;
    try {
      connection = await pool.getConnection();
      const result = await connection.execute(query, params);
      return result.rows;
    } catch (error) {
      logger.error('Query execution failed:', error);
      throw error;
    } finally {
      if (connection) {
        await connection.close();
      }
    }
  }

  async executeCorportalQuery(query, params = []) {
    return await this.executeQuery(this.corportalPool, query, params);
  }

  async executeCCBQuery(query, params = []) {
    return await this.executeQuery(this.ccbPool, query, params);
  }

  async closePools() {
    try {
      if (this.corportalPool) {
        await this.corportalPool.close();
        logger.info('CORPORTAL database pool closed');
      }
      if (this.ccbPool) {
        await this.ccbPool.close();
        logger.info('CCB database pool closed');
      }
    } catch (error) {
      logger.error('Error closing database pools:', error);
    }
  }

  async testConnections() {
    try {
      const corportalTest = await this.executeCorportalQuery('SELECT SYSDATE FROM DUAL');
      const ccbTest = await this.executeCCBQuery('SELECT SYSDATE FROM DUAL');
      
      logger.info('Database connections test passed');
      return {
        corportal: corportalTest[0],
        ccb: ccbTest[0]
      };
    } catch (error) {
      logger.error('Database connection test failed:', error);
      throw error;
    }
  }
}

// Singleton instance
const dbManager = new DatabaseManager();

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, closing database pools...');
  await dbManager.closePools();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, closing database pools...');
  await dbManager.closePools();
  process.exit(0);
});

module.exports = dbManager;