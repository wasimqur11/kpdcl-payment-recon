import React, { useState, useEffect } from 'react';
import { 
  Row, 
  Col, 
  DatePicker, 
  Select, 
  Button, 
  Space, 
  Spin, 
  Alert, 
  message,
  Card,
  Statistic
} from 'antd';
import { 
  SyncOutlined, 
  DownloadOutlined, 
  CalendarOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import moment from 'moment';
import { DashboardAPI, ReconciliationAPI } from '../../services/api';
import { ReconciliationSummary, PaymentTrends, ReconciliationStats } from '../../types';
import ReconciliationSummaryChart from '../../components/Charts/ReconciliationSummaryChart';
import PaymentTrendsChart from '../../components/Charts/PaymentTrendsChart';

const { RangePicker } = DatePicker;
const { Option } = Select;

const Dashboard: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState<[moment.Moment, moment.Moment]>([
    moment().subtract(7, 'days'),
    moment()
  ]);
  const [paymentMode, setPaymentMode] = useState<string | undefined>(undefined);
  const [reconciliationData, setReconciliationData] = useState<ReconciliationSummary | null>(null);
  const [trendsData, setTrendsData] = useState<PaymentTrends | null>(null);
  const [statsData, setStatsData] = useState<ReconciliationStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const fromDate = dateRange[0].format('YYYY-MM-DD');
      const toDate = dateRange[1].format('YYYY-MM-DD');
      
      // Fetch all dashboard data in parallel
      const [summaryResponse, trendsResponse, statsResponse] = await Promise.all([
        DashboardAPI.getReconciliationSummary(fromDate, toDate, paymentMode),
        DashboardAPI.getPaymentTrends(fromDate, toDate),
        DashboardAPI.getReconciliationStats(fromDate, toDate)
      ]);
      
      setReconciliationData(summaryResponse);
      setTrendsData(trendsResponse.trends);
      setStatsData(statsResponse.kpis);
      setLastUpdated(moment().format('YYYY-MM-DD HH:mm:ss'));
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch dashboard data';
      setError(errorMessage);
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleRunReconciliation = async () => {
    setLoading(true);
    try {
      const fromDate = dateRange[0].format('YYYY-MM-DD');
      const toDate = dateRange[1].format('YYYY-MM-DD');
      
      await ReconciliationAPI.runReconciliation(fromDate, toDate);
      message.success('Reconciliation completed successfully');
      
      // Refresh data after reconciliation
      await fetchDashboardData();
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to run reconciliation';
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const fromDate = dateRange[0].format('YYYY-MM-DD');
      const toDate = dateRange[1].format('YYYY-MM-DD');
      
      const data = await ReconciliationAPI.exportData(fromDate, toDate, 'summary');
      
      // Create and download file
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `reconciliation-summary-${fromDate}-to-${toDate}.json`;
      link.click();
      window.URL.revokeObjectURL(url);
      
      message.success('Export completed successfully');
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to export data';
      message.error(errorMessage);
    }
  };

  // Fetch data on component mount and when filters change
  useEffect(() => {
    fetchDashboardData();
  }, [dateRange, paymentMode]);

  return (
    <div>
      {/* Header with Controls */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '600' }}>
            Payment Reconciliation Dashboard
          </h1>
          {lastUpdated && (
            <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>
              Last updated: {lastUpdated}
            </p>
          )}
        </Col>
        
        <Col>
          <Space wrap>
            <RangePicker
              value={dateRange}
              onChange={(dates) => dates && setDateRange(dates)}
              format="YYYY-MM-DD"
              allowClear={false}
              suffixIcon={<CalendarOutlined />}
            />
            
            <Select
              placeholder="All Payment Modes"
              style={{ width: 200 }}
              value={paymentMode}
              onChange={setPaymentMode}
              allowClear
            >
              <Option value="BANK_COUNTER">Bank Counter</Option>
              <Option value="BILLSAHULIYAT_PLUS">Billsahuliyat Plus</Option>
              <Option value="SMART_BS">Smart BS</Option>
              <Option value="JK_BANK_MPAY">JK Bank Mpay</Option>
              <Option value="BBPS">BBPS</Option>
              <Option value="POS_MACHINES">POS Machines</Option>
            </Select>
            
            <Button 
              icon={<ReloadOutlined />}
              onClick={fetchDashboardData}
              loading={loading}
            >
              Refresh
            </Button>
            
            <Button
              type="primary"
              icon={<SyncOutlined />}
              onClick={handleRunReconciliation}
              loading={loading}
            >
              Run Reconciliation
            </Button>
            
            <Button
              icon={<DownloadOutlined />}
              onClick={handleExport}
              disabled={!reconciliationData}
            >
              Export
            </Button>
          </Space>
        </Col>
      </Row>

      {/* Error Alert */}
      {error && (
        <Alert
          message="Error Loading Dashboard"
          description={error}
          type="error"
          closable
          onClose={() => setError(null)}
          style={{ marginBottom: 16 }}
        />
      )}

      {/* Loading Spinner */}
      <Spin spinning={loading} size="large">
        
        {/* Key Performance Indicators */}
        {statsData && (
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={12} sm={8} lg={4}>
              <Card>
                <Statistic
                  title="Data Quality Score"
                  value={parseFloat(statsData.dataQualityScore)}
                  suffix="%"
                  valueStyle={{ 
                    color: parseFloat(statsData.dataQualityScore) >= 95 ? '#52c41a' : '#faad14' 
                  }}
                />
              </Card>
            </Col>
            
            <Col xs={12} sm={8} lg={4}>
              <Card>
                <Statistic
                  title="Exception Rate"
                  value={parseFloat(statsData.exceptionRate)}
                  suffix="%"
                  valueStyle={{ 
                    color: parseFloat(statsData.exceptionRate) <= 5 ? '#52c41a' : '#ff4d4f' 
                  }}
                />
              </Card>
            </Col>
            
            <Col xs={12} sm={8} lg={4}>
              <Card>
                <Statistic
                  title="Avg Settlement Days"
                  value={parseFloat(statsData.avgSettlementDays)}
                  precision={1}
                  suffix="days"
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>
            
            <Col xs={12} sm={8} lg={4}>
              <Card>
                <Statistic
                  title="Critical Exceptions"
                  value={statsData.criticalExceptions}
                  valueStyle={{ 
                    color: statsData.criticalExceptions === 0 ? '#52c41a' : '#ff4d4f' 
                  }}
                />
              </Card>
            </Col>
            
            <Col xs={12} sm={8} lg={4}>
              <Card>
                <Statistic
                  title="Reconciliation Efficiency"
                  value={statsData.reconciliationEfficiency}
                  suffix="%"
                  precision={1}
                  valueStyle={{ 
                    color: statsData.reconciliationEfficiency >= 95 ? '#52c41a' : '#faad14' 
                  }}
                />
              </Card>
            </Col>
            
            <Col xs={12} sm={8} lg={4}>
              <Card>
                <Statistic
                  title="Amount Reconciliation"
                  value={statsData.amountReconciliationRate}
                  suffix="%"
                  precision={1}
                  valueStyle={{ 
                    color: statsData.amountReconciliationRate >= 98 ? '#52c41a' : '#faad14' 
                  }}
                />
              </Card>
            </Col>
          </Row>
        )}

        {/* Reconciliation Summary Charts */}
        {reconciliationData && (
          <div style={{ marginBottom: 24 }}>
            <ReconciliationSummaryChart 
              data={reconciliationData} 
              loading={loading} 
            />
          </div>
        )}

        {/* Payment Trends Charts */}
        {trendsData && (
          <div style={{ marginBottom: 24 }}>
            <PaymentTrendsChart 
              data={trendsData} 
              loading={loading} 
            />
          </div>
        )}

        {/* No Data Message */}
        {!loading && !reconciliationData && !error && (
          <Card>
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <h3>No Data Available</h3>
              <p>Please select a date range and click "Run Reconciliation" to view data.</p>
            </div>
          </Card>
        )}
        
      </Spin>
    </div>
  );
};

export default Dashboard;