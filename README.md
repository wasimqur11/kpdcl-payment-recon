# KPDCL Payment Reconciliation Dashboard

A comprehensive audit dashboard for monitoring payment integrity across all KPDCL payment modes with real-time reconciliation capabilities.

## Overview

This dashboard helps KPDCL supervise the integrity of payment postings by providing:
- Birds-eye view of payments received in various modes
- Validation against actual postings to CCB (Customer Care & Billing) system
- Exception management and reporting
- Automated reconciliation with fuzzy matching
- Export capabilities for audit trails

## Architecture

### Data Sources
- **CORPORTAL Database**: Contains MIS data imported from JK Bank FTP files (authoritative payment records)
- **CCB Database**: Payment posting data (read-only access)

### Technology Stack

**Backend:**
- Node.js with Express.js
- Oracle database integration (oracledb)
- Winston for logging
- ExcelJS for export functionality

**Frontend:**
- React with TypeScript
- Ant Design UI components
- Recharts for data visualization
- Axios for API communication

## Features

### 1. Executive Dashboard
- Real-time payment volume tracking by mode
- Reconciliation status indicators
- Key Performance Indicators (KPIs)
- Settlement lag analysis (T+0 vs T+1)

### 2. Automated Reconciliation Engine
- **Exact Matching**: Consumer ID + Amount + Payment Mode + Date range
- **Fuzzy Matching**: Similar amounts with tolerance + time window
- **Settlement Period Awareness**: T+0 (Bank Counter) vs T+1 (Online modes)
- **Exception Detection**: Unmatched payments from either system

### 3. Exception Management
- Unmatched CORPORTAL payments (received but not posted)
- Unmatched CCB payments (posted without CORPORTAL record)
- Amount mismatches requiring manual review
- Aging analysis with action requirements

### 4. Analytics and Reporting
- Payment trends analysis (daily/monthly)
- Payment mode performance comparison
- Variance analysis and root cause identification
- Historical reconciliation metrics

### 5. Export Capabilities
- Excel reports with multiple worksheets
- CSV exports for data analysis
- Automated report generation
- Audit trail documentation

## Payment Modes Supported

1. **Over the Counter (Bank)** - T+0 settlement
2. **KPDCL Billsahuliyat Plus App** - T+1 settlement
3. **Smart BS App** - T+1 settlement
4. **JK Bank Mpay App** - T+1 settlement
5. **Bharat Bill Payment System (BBPS)** - T+1 settlement
6. **Point of Sale Machines** - T+1 settlement

## Installation

### Prerequisites
- Node.js (v16 or higher)
- Oracle Database access (CORPORTAL and CCB)
- npm or yarn package manager

### Backend Setup

1. Clone the repository and install dependencies:
```bash
npm install
```

2. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your database credentials
```

3. Start the backend server:
```bash
npm run dev
```

### Frontend Setup

1. Install client dependencies:
```bash
npm run install-client
```

2. Start the React development server:
```bash
npm run client
```

## Configuration

### Environment Variables

```env
# Database Configuration
CORPORTAL_DB_HOST=your-corportal-host
CORPORTAL_DB_PORT=1521
CORPORTAL_DB_SERVICE=your-corportal-service
CORPORTAL_DB_USER=your-corportal-username
CORPORTAL_DB_PASSWORD=your-corportal-password

CCB_DB_HOST=your-ccb-host
CCB_DB_PORT=1521
CCB_DB_SERVICE=your-ccb-service
CCB_DB_USER=your-ccb-username
CCB_DB_PASSWORD=your-ccb-password

# Application Configuration
PORT=5000
NODE_ENV=development
LOG_LEVEL=info
```

## API Endpoints

### Dashboard APIs
- `GET /api/dashboard/summary` - Reconciliation summary
- `GET /api/dashboard/detailed-reconciliation` - Detailed matching results
- `GET /api/dashboard/exceptions` - Payment exceptions
- `GET /api/dashboard/payment-trends` - Trends analysis
- `GET /api/dashboard/stats` - KPI statistics

### Reconciliation APIs
- `POST /api/reconciliation/run` - Trigger manual reconciliation
- `GET /api/reconciliation/corportal-payments` - CORPORTAL payment data
- `GET /api/reconciliation/ccb-payments` - CCB payment data
- `GET /api/reconciliation/export` - Export functionality

## Database Schema Requirements

### CORPORTAL_PAYMENTS Table
```sql
CREATE TABLE CORPORTAL_PAYMENTS (
  CONSUMER_ID VARCHAR2(20),
  PAYMENT_MODE VARCHAR2(50),
  AMOUNT NUMBER(15,2),
  TRANSACTION_ID VARCHAR2(50),
  PAYMENT_DATE DATE,
  BANK_REF_NUMBER VARCHAR2(50),
  STATUS VARCHAR2(20),
  CREATED_DATE DATE
);
```

### CCB_PAYMENTS Table
```sql
CREATE TABLE CCB_PAYMENTS (
  CONSUMER_NO VARCHAR2(20),
  PAYMENT_MODE VARCHAR2(50),
  PAID_AMOUNT NUMBER(15,2),
  TRANSACTION_REF VARCHAR2(50),
  PAYMENT_DATE DATE,
  POSTING_DATE DATE,
  PAYMENT_STATUS VARCHAR2(20),
  CREATED_DATE DATE
);
```

## Usage

### 1. Running Reconciliation
1. Select date range (max 90 days)
2. Optionally filter by payment mode
3. Click "Run Reconciliation"
4. Review results in dashboard

### 2. Exception Management
1. Navigate to Exceptions view
2. Filter by severity (critical/all)
3. Review unmatched payments
4. Export for investigation

### 3. Exporting Reports
1. Select date range and report type
2. Choose format (Excel/CSV)
3. Click "Export" to download

## Monitoring and Maintenance

### Performance Optimization
- Database connection pooling
- Query optimization with indexes
- Result caching for frequent requests
- Pagination for large datasets

### Logging
- Application logs in `logs/` directory
- Error tracking with stack traces
- API request/response logging
- Database query performance logs

### Error Handling
- Graceful database connection failures
- API timeout handling
- User-friendly error messages
- Automatic retry mechanisms

## Security Considerations

- Read-only database access for CCB
- Input validation and sanitization
- Rate limiting on API endpoints
- Secure credential management
- Audit trail for all operations

## Support and Maintenance

### Troubleshooting
- Check database connectivity
- Verify environment variables
- Review application logs
- Validate date range parameters

### Common Issues
- **Database Connection Timeout**: Increase timeout values
- **Large Dataset Performance**: Use pagination and filters
- **Memory Issues**: Implement result streaming for exports

## Future Enhancements

1. **Real-time Reconciliation**: WebSocket integration for live updates
2. **Machine Learning**: Pattern recognition for exception prediction
3. **Mobile App**: Mobile interface for field staff
4. **Integration APIs**: Connect with other KPDCL systems
5. **Advanced Analytics**: Predictive analytics and trend forecasting

## License

Internal use only - KPDCL IT Department

## Contact

For technical support or feature requests, contact the KPDCL IT Team.