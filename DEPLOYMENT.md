# 🚀 Production Deployment Guide
## KPDCL Payment Reconciliation Dashboard

This guide provides step-by-step instructions for deploying the KPDCL Payment Reconciliation Dashboard in a production environment.

---

## 📋 Prerequisites

### System Requirements
- **Operating System**: Linux (Ubuntu 20.04 LTS or CentOS 8+) or Windows Server 2019+
- **Node.js**: Version 18.x or higher
- **RAM**: Minimum 4GB, Recommended 8GB+
- **Storage**: 20GB+ available disk space
- **Network**: Access to Oracle databases (CORPORTAL & CCB)

### Database Requirements
- **Oracle Database**: 11g or higher
- **CORPORTAL Database**: Read/Write access
- **CCB Database**: Read-only access
- **Network Connectivity**: Ports 1521 (Oracle) accessible from application server

### Security Requirements
- **SSL Certificate**: For HTTPS deployment
- **Firewall**: Configure ports 80, 443, and application port
- **User Accounts**: Non-root user for application execution

---

## 🌐 Deployment Options

Choose one of the following deployment methods:

### Option 1: Traditional Server Deployment
### Option 2: Docker Container Deployment
### Option 3: Cloud Platform Deployment (AWS/Azure/GCP)
### Option 4: On-Premises Server Deployment

---

## 🔧 Option 1: Traditional Server Deployment

### Step 1: Server Setup

#### 1.1 Create Application User
```bash
# Create dedicated user for the application
sudo adduser kpdcl
sudo usermod -aG sudo kpdcl
su - kpdcl
```

#### 1.2 Install Node.js
```bash
# Install Node.js 18.x LTS
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version
npm --version
```

#### 1.3 Install Process Manager (PM2)
```bash
sudo npm install -g pm2
pm2 startup
```

#### 1.4 Install Oracle Instant Client
```bash
# Download Oracle Instant Client
cd /opt
sudo wget https://download.oracle.com/otn_software/linux/instantclient/1920000/instantclient-basic-linux.x64-19.20.0.0.0dbru.zip
sudo unzip instantclient-basic-linux.x64-19.20.0.0.0dbru.zip

# Set environment variables
echo 'export LD_LIBRARY_PATH=/opt/instantclient_19_20:$LD_LIBRARY_PATH' >> ~/.bashrc
source ~/.bashrc
```

### Step 2: Application Deployment

#### 2.1 Clone Repository
```bash
cd /home/kpdcl
git clone https://github.com/wasimqur11/kpdcl-payment-recon.git
cd kpdcl-payment-recon
```

#### 2.2 Install Dependencies
```bash
# Install backend dependencies
npm install

# Install frontend dependencies
cd client
npm install
cd ..
```

#### 2.3 Build Frontend
```bash
cd client
npm run build
cd ..
```

#### 2.4 Configure Environment
```bash
# Copy environment template
cp .env.example .env

# Edit environment variables
nano .env
```

**Environment Configuration:**
```bash
# Production Database Configuration
CORPORTAL_DB_HOST=your-corportal-production-host
CORPORTAL_DB_PORT=1521
CORPORTAL_DB_SERVICE=your-corportal-service
CORPORTAL_DB_USER=your-corportal-username
CORPORTAL_DB_PASSWORD=your-secure-password

CCB_DB_HOST=your-ccb-production-host
CCB_DB_PORT=1521
CCB_DB_SERVICE=your-ccb-service
CCB_DB_USER=your-ccb-username
CCB_DB_PASSWORD=your-secure-password

# Application Configuration
PORT=3001
NODE_ENV=production

# Security
JWT_SECRET=your-super-secure-jwt-secret-key-change-this

# Logging
LOG_LEVEL=info
```

#### 2.5 Create PM2 Ecosystem File
```bash
nano ecosystem.config.js
```

```javascript
module.exports = {
  apps: [{
    name: 'kpdcl-payment-recon',
    script: 'server.js',
    instances: 2,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    log_file: 'logs/combined.log',
    out_file: 'logs/out.log',
    error_file: 'logs/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm Z',
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=1024'
  }]
};
```

#### 2.6 Start Application
```bash
# Create logs directory
mkdir -p logs

# Start application with PM2
pm2 start ecosystem.config.js --env production

# Save PM2 configuration
pm2 save

# Check application status
pm2 status
pm2 logs kpdcl-payment-recon
```

---

## 🐳 Option 2: Docker Container Deployment

### Step 1: Create Dockerfile
```bash
nano Dockerfile
```

```dockerfile
# Multi-stage build
FROM node:18-alpine AS build

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY client/package*.json ./client/

# Install dependencies
RUN npm ci --only=production
RUN cd client && npm ci --only=production

# Copy source code
COPY . .

# Build frontend
RUN cd client && npm run build

# Production stage
FROM node:18-alpine AS production

# Install Oracle Instant Client
RUN apk add --no-cache libaio libnsl libc6-compat curl && \
    cd /tmp && \
    curl -o instantclient-basiclite.zip https://download.oracle.com/otn_software/linux/instantclient/instantclient-basiclite-linuxx64.zip && \
    unzip instantclient-basiclite.zip && \
    mv instantclient_* /usr/lib/instantclient && \
    rm instantclient-basiclite.zip && \
    ln -s /usr/lib/instantclient/libclntsh.so.* /usr/lib/instantclient/libclntsh.so && \
    ln -s /usr/lib/instantclient/libocci.so.* /usr/lib/instantclient/libocci.so && \
    ln -s /lib/libc.so.6 /usr/lib/libresolv.so.2 && \
    ln -s /lib64/ld-linux-x86-64.so.2 /usr/lib/instantclient/ld-linux-x86-64.so.2

ENV LD_LIBRARY_PATH=/usr/lib/instantclient

# Create app directory
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S kpdcl -u 1001

# Copy built application
COPY --from=build --chown=kpdcl:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=kpdcl:nodejs /app/client/build ./client/build
COPY --from=build --chown=kpdcl:nodejs /app . .

# Create logs directory
RUN mkdir -p logs && chown -R kpdcl:nodejs logs

# Switch to non-root user
USER kpdcl

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/api/health || exit 1

# Start application
CMD ["node", "server.js"]
```

### Step 2: Create Docker Compose File
```bash
nano docker-compose.yml
```

```yaml
version: '3.8'

services:
  kpdcl-dashboard:
    build: .
    container_name: kpdcl-payment-recon
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - PORT=3001
    env_file:
      - .env
    volumes:
      - ./logs:/app/logs
      - /etc/localtime:/etc/localtime:ro
    restart: unless-stopped
    networks:
      - kpdcl-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  nginx:
    image: nginx:alpine
    container_name: kpdcl-nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./nginx/ssl:/etc/nginx/ssl
      - ./logs/nginx:/var/log/nginx
    depends_on:
      - kpdcl-dashboard
    restart: unless-stopped
    networks:
      - kpdcl-network

networks:
  kpdcl-network:
    driver: bridge
```

### Step 3: Deploy with Docker
```bash
# Build and start containers
docker-compose up -d

# Check container status
docker-compose ps

# View logs
docker-compose logs -f kpdcl-dashboard
```

---

## 🌍 Option 3: Nginx Reverse Proxy Setup

### Step 1: Install Nginx
```bash
sudo apt update
sudo apt install nginx
```

### Step 2: Configure SSL Certificate
```bash
# Install Certbot for Let's Encrypt
sudo apt install certbot python3-certbot-nginx

# Obtain SSL certificate (replace with your domain)
sudo certbot --nginx -d kpdcl-dashboard.your-domain.com
```

### Step 3: Create Nginx Configuration
```bash
sudo nano /etc/nginx/sites-available/kpdcl-dashboard
```

```nginx
# KPDCL Payment Reconciliation Dashboard
upstream kpdcl_backend {
    server 127.0.0.1:3001;
    server 127.0.0.1:3002;  # If running multiple instances
    keepalive 32;
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name kpdcl-dashboard.your-domain.com;
    return 301 https://$server_name$request_uri;
}

# HTTPS Configuration
server {
    listen 443 ssl http2;
    server_name kpdcl-dashboard.your-domain.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/kpdcl-dashboard.your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/kpdcl-dashboard.your-domain.com/privkey.pem;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:50m;
    ssl_stapling on;
    ssl_stapling_verify on;

    # Security Headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload";
    add_header Referrer-Policy "strict-origin-when-cross-origin";

    # Logging
    access_log /var/log/nginx/kpdcl-dashboard.access.log;
    error_log /var/log/nginx/kpdcl-dashboard.error.log;

    # Gzip Compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private auth;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

    # Client Max Body Size
    client_max_body_size 10M;

    # Main Location
    location / {
        proxy_pass http://kpdcl_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # API Routes with longer timeouts
    location /api/ {
        proxy_pass http://kpdcl_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_connect_timeout 120s;
        proxy_send_timeout 120s;
        proxy_read_timeout 120s;
    }

    # Static Files Caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        proxy_pass http://kpdcl_backend;
    }

    # Health Check
    location /api/health {
        access_log off;
        proxy_pass http://kpdcl_backend;
        proxy_connect_timeout 5s;
        proxy_send_timeout 5s;
        proxy_read_timeout 5s;
    }
}
```

### Step 4: Enable Site and Restart Nginx
```bash
# Enable the site
sudo ln -s /etc/nginx/sites-available/kpdcl-dashboard /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

---

## 📊 Database Setup in Production

### Step 1: Create Database Tables
```bash
# Connect to Oracle databases and run the initialization script
node scripts/init-db.js
```

### Step 2: CORPORTAL Database Setup
```sql
-- Connect to CORPORTAL database
-- Create CORPORTAL_PAYMENTS table
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

-- Create indexes for performance
CREATE INDEX IDX_CORPORTAL_CONSUMER_DATE ON CORPORTAL_PAYMENTS(CONSUMER_ID, PAYMENT_DATE);
CREATE INDEX IDX_CORPORTAL_MODE_DATE ON CORPORTAL_PAYMENTS(PAYMENT_MODE, PAYMENT_DATE);
CREATE INDEX IDX_CORPORTAL_AMOUNT ON CORPORTAL_PAYMENTS(AMOUNT);
CREATE INDEX IDX_CORPORTAL_STATUS_DATE ON CORPORTAL_PAYMENTS(STATUS, PAYMENT_DATE);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON CORPORTAL_PAYMENTS TO your_app_user;
```

### Step 3: CCB Database Setup
```sql
-- Connect to CCB database
-- Create CCB_PAYMENTS table (if not exists)
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

-- Create indexes for performance
CREATE INDEX IDX_CCB_CONSUMER_DATE ON CCB_PAYMENTS(CONSUMER_NO, POSTING_DATE);
CREATE INDEX IDX_CCB_MODE_DATE ON CCB_PAYMENTS(PAYMENT_MODE, POSTING_DATE);
CREATE INDEX IDX_CCB_AMOUNT ON CCB_PAYMENTS(PAID_AMOUNT);
CREATE INDEX IDX_CCB_STATUS_DATE ON CCB_PAYMENTS(PAYMENT_STATUS, POSTING_DATE);

-- Grant read-only permissions
GRANT SELECT ON CCB_PAYMENTS TO your_app_user;
```

---

## 🔒 Security Configuration

### Step 1: Firewall Setup
```bash
# Configure UFW firewall
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw allow 3001/tcp  # Application (if direct access needed)
sudo ufw enable
```

### Step 2: Application Security
```bash
# Set proper file permissions
sudo chown -R kpdcl:kpdcl /home/kpdcl/kpdcl-payment-recon
sudo chmod -R 755 /home/kpdcl/kpdcl-payment-recon
sudo chmod 600 /home/kpdcl/kpdcl-payment-recon/.env
```

### Step 3: Database Security
- Use dedicated database users with minimal required permissions
- Enable Oracle database audit logging
- Configure network encryption between application and database
- Implement connection pooling limits

---

## 📈 Monitoring and Logging

### Step 1: PM2 Monitoring
```bash
# Install PM2 monitoring
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7

# Monitor application
pm2 monit
```

### Step 2: Application Logs
```bash
# View application logs
tail -f logs/combined.log
tail -f logs/error.log

# Setup log rotation
sudo nano /etc/logrotate.d/kpdcl-dashboard
```

```
/home/kpdcl/kpdcl-payment-recon/logs/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 644 kpdcl kpdcl
    postrotate
        pm2 reloadLogs
    endscript
}
```

### Step 3: System Monitoring
```bash
# Install system monitoring tools
sudo apt install htop iotop nethogs

# Monitor system resources
htop
iotop
nethogs
```

---

## 🔄 Backup and Recovery

### Step 1: Database Backup Strategy
```bash
# Create backup script
nano /home/kpdcl/scripts/backup-db.sh
```

```bash
#!/bin/bash
# Database backup script
BACKUP_DIR="/home/kpdcl/backups"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup CORPORTAL data (if applicable)
# Add your database backup commands here

# Clean old backups (keep last 7 days)
find $BACKUP_DIR -type f -mtime +7 -delete

echo "Backup completed: $DATE"
```

### Step 2: Application Backup
```bash
# Create application backup script
nano /home/kpdcl/scripts/backup-app.sh
```

```bash
#!/bin/bash
# Application backup script
APP_DIR="/home/kpdcl/kpdcl-payment-recon"
BACKUP_DIR="/home/kpdcl/backups"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup
tar -czf "$BACKUP_DIR/kpdcl-app-backup-$DATE.tar.gz" \
  --exclude="node_modules" \
  --exclude="client/node_modules" \
  --exclude="logs" \
  --exclude=".git" \
  -C /home/kpdcl kpdcl-payment-recon

echo "Application backup completed: $DATE"
```

### Step 3: Automated Backups
```bash
# Setup cron jobs
crontab -e

# Add backup schedules
0 2 * * * /home/kpdcl/scripts/backup-db.sh >> /home/kpdcl/logs/backup.log 2>&1
0 3 * * 0 /home/kpdcl/scripts/backup-app.sh >> /home/kpdcl/logs/backup.log 2>&1
```

---

## 🚀 Deployment Checklist

### Pre-Deployment
- [ ] Server hardware meets requirements
- [ ] Oracle databases are accessible
- [ ] SSL certificates are obtained
- [ ] Environment variables are configured
- [ ] Database tables are created
- [ ] Security configurations are applied

### Deployment
- [ ] Application code is deployed
- [ ] Dependencies are installed
- [ ] Frontend is built
- [ ] PM2 is configured and running
- [ ] Nginx is configured and running
- [ ] SSL is properly configured

### Post-Deployment
- [ ] Application health check passes
- [ ] Database connectivity is verified
- [ ] All API endpoints are responding
- [ ] Logs are being generated properly
- [ ] Monitoring is configured
- [ ] Backup procedures are set up
- [ ] Performance testing is completed

### Production Verification
- [ ] Dashboard loads correctly
- [ ] Real payment data is displaying
- [ ] Reconciliation process works
- [ ] Exception reporting functions
- [ ] Export functionality works
- [ ] User authentication (if implemented)
- [ ] Load testing completed

---

## 🆘 Troubleshooting

### Common Issues

#### Application Won't Start
```bash
# Check PM2 logs
pm2 logs kpdcl-payment-recon

# Check environment variables
cat .env

# Verify database connectivity
node scripts/init-db.js
```

#### Database Connection Issues
```bash
# Test Oracle connectivity
tnsping your-database-service

# Check environment variables
echo $LD_LIBRARY_PATH

# Verify Oracle client installation
ldd node_modules/oracledb/lib/oracledb-*.node
```

#### Performance Issues
```bash
# Monitor system resources
htop
iostat -x 1

# Check application metrics
pm2 monit

# Analyze logs
tail -f logs/error.log | grep -i "slow\|timeout\|error"
```

### Support Contacts
- **Technical Support**: your-it-team@kpdcl.com
- **Database Team**: dba-team@kpdcl.com
- **Network Team**: network-team@kpdcl.com

---

## 📚 Additional Resources

- [Node.js Production Best Practices](https://nodejs.org/en/docs/guides/nodejs-docker-webapp/)
- [PM2 Documentation](https://pm2.keymetrics.io/docs/)
- [Nginx Configuration Guide](https://nginx.org/en/docs/)
- [Oracle Database Connection Guide](https://node-oracledb.readthedocs.io/)
- [Docker Production Guide](https://docs.docker.com/config/containers/logging/)

---

*This deployment guide is maintained by the KPDCL IT Team. Last updated: August 2024*