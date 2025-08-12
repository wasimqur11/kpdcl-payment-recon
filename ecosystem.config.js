// PM2 Ecosystem Configuration for KPDCL Payment Reconciliation Dashboard
module.exports = {
  apps: [{
    // Application configuration
    name: 'kpdcl-payment-recon',
    script: 'server.js',
    cwd: '/home/kpdcl/kpdcl-payment-recon',
    
    // Process management
    instances: 2,
    exec_mode: 'cluster',
    max_memory_restart: '1G',
    min_uptime: '10s',
    max_restarts: 5,
    
    // Environment variables
    env: {
      NODE_ENV: 'development',
      PORT: 3001,
      LOG_LEVEL: 'info'
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3001,
      LOG_LEVEL: 'info'
    },
    env_staging: {
      NODE_ENV: 'staging',
      PORT: 3002,
      LOG_LEVEL: 'debug'
    },
    
    // Logging configuration
    log_file: 'logs/combined.log',
    out_file: 'logs/out.log',
    error_file: 'logs/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    
    // Advanced process management
    kill_timeout: 3000,
    listen_timeout: 3000,
    wait_ready: true,
    
    // Node.js specific options
    node_args: '--max-old-space-size=1024',
    
    // Monitoring
    monitoring: false,
    pmx: false,
    
    // Auto restart conditions
    watch: false,
    ignore_watch: [
      'node_modules',
      'logs',
      'client/node_modules',
      'client/build',
      '.git'
    ],
    
    // Instance configuration
    instance_var: 'INSTANCE_ID',
    
    // Graceful shutdown
    shutdown_with_message: true,
    
    // Process lifecycle hooks
    post_update: ['npm install', 'echo "Application updated"'],
    
    // Error handling
    autorestart: true,
    max_restarts: 10,
    min_uptime: '1m',
    
    // Log rotation (if pm2-logrotate is installed)
    log_type: 'json',
    
    // Health monitoring
    health_check_grace_period: 3000,
    health_check_fatal_exceptions: true
  }],

  // Deployment configuration
  deploy: {
    production: {
      user: 'kpdcl',
      host: ['your-production-server.com'],
      ref: 'origin/main',
      repo: 'https://github.com/wasimqur11/kpdcl-payment-recon.git',
      path: '/home/kpdcl/kpdcl-payment-recon',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env production',
      'pre-setup': 'apt update && apt install git -y'
    },
    staging: {
      user: 'kpdcl',
      host: ['your-staging-server.com'],
      ref: 'origin/develop',
      repo: 'https://github.com/wasimqur11/kpdcl-payment-recon.git',
      path: '/home/kpdcl/kpdcl-payment-recon-staging',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env staging',
      'pre-setup': 'apt update && apt install git -y'
    }
  }
};