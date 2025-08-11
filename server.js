const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

const logger = require('./utils/logger');
const reconciliationRoutes = require('./routes/reconciliation');
const dashboardRoutes = require('./routes/dashboard');
const dbManager = require('./config/database');

const app = express();
const PORT = process.env.PORT || 3001;

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

// Middleware
app.use(helmet({
  contentSecurityPolicy: false
}));
app.use(compression());
app.use(limiter);
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000', 'http://127.0.0.1:3001'],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Serve static files from React build if available
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'client/build')));
}

// Routes
app.use('/api/reconciliation', reconciliationRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Test endpoint for database connectivity
app.get('/api/test-db', async (req, res) => {
  try {
    await dbManager.initializePools();
    const testResult = await dbManager.testConnections();
    res.json({
      status: 'Database Connected',
      connections: testResult,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'Database Connection Failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Serve main dashboard page for all non-API routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

// Serve React app for production if available
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ error: 'API endpoint not found' });
    }
    res.sendFile(path.join(__dirname, 'client/build/index.html'));
  });
} else {
  // In development, serve the main HTML for all non-API routes
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ error: 'API endpoint not found' });
    }
    res.sendFile(path.join(__dirname, 'public/index.html'));
  });
}

// Error handling middleware
app.use((error, req, res, next) => {
  logger.error('Unhandled error:', error);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// Initialize database and start server
async function startServer() {
  try {
    // Try to initialize database pools, but don't fail if it doesn't work
    try {
      await dbManager.initializePools();
      logger.info('✅ Database pools initialized successfully');
    } catch (dbError) {
      logger.warn('⚠️  Database initialization failed - running in demo mode:', dbError.message);
      logger.info('📝 The application will work with mock data. Configure database to enable full functionality.');
    }
    
    // Start the server
    app.listen(PORT, '0.0.0.0', () => {
      logger.info(`🚀 KPDCL Payment Reconciliation Dashboard`);
      logger.info(`🌐 Server running on: http://localhost:${PORT}`);
      logger.info(`🔧 API Base URL: http://localhost:${PORT}/api`);
      logger.info(`🏥 Health Check: http://localhost:${PORT}/api/health`);
      logger.info(`📊 Dashboard: http://localhost:${PORT}`);
      logger.info(`🗄️  Database Test: http://localhost:${PORT}/api/test-db`);
      logger.info(`📁 Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info('');
      logger.info('🎯 Ready to receive requests!');
    });
    
  } catch (error) {
    logger.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();

module.exports = app;