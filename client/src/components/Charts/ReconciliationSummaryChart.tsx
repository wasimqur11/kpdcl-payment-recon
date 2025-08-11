import React from 'react';
import { Card, Row, Col, Statistic, Progress, Tag } from 'antd';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { 
  ArrowUpOutlined, 
  ArrowDownOutlined, 
  CheckCircleOutlined,
  ExclamationCircleOutlined 
} from '@ant-design/icons';
import { ReconciliationSummary, PAYMENT_MODES } from '../../types';
import { formatCurrency, calculatePercentage, getVarianceColor } from '../../services/api';

interface ReconciliationSummaryChartProps {
  data: ReconciliationSummary;
  loading?: boolean;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

const ReconciliationSummaryChart: React.FC<ReconciliationSummaryChartProps> = ({ 
  data, 
  loading = false 
}) => {
  
  // Prepare bar chart data
  const barChartData = Object.entries(data.byPaymentMode || {}).map(([mode, values]) => ({
    paymentMode: PAYMENT_MODES[mode as keyof typeof PAYMENT_MODES] || mode,
    corportal: values.corportalAmount,
    ccb: values.ccbAmount,
    variance: values.variance,
    corportalCount: values.corportalCount,
    ccbCount: values.ccbCount
  }));

  // Prepare pie chart data for reconciliation status
  const pieChartData = [
    {
      name: 'Matched',
      value: data.matchedCount || 0,
      color: '#52c41a'
    },
    {
      name: 'Unmatched CORPORTAL',
      value: data.unmatchedCorportalCount || 0,
      color: '#faad14'
    },
    {
      name: 'Unmatched CCB',
      value: data.unmatchedCCBCount || 0,
      color: '#ff7875'
    },
    {
      name: 'Amount Mismatch',
      value: data.amountMismatchCount || 0,
      color: '#ff4d4f'
    }
  ].filter(item => item.value > 0);

  const totalPayments = data.corportalCount + data.ccbCount;
  const reconciliationEfficiency = totalPayments > 0 
    ? ((data.matchedCount / totalPayments) * 100).toFixed(1)
    : '0';

  return (
    <div>
      {/* Summary Statistics */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total CORPORTAL Amount"
              value={data.corportalTotal || 0}
              precision={2}
              valueStyle={{ color: '#1890ff' }}
              prefix="₹"
              suffix={
                <Tag color="blue">{data.corportalCount || 0} txns</Tag>
              }
            />
          </Card>
        </Col>
        
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total CCB Amount"
              value={data.ccbTotal || 0}
              precision={2}
              valueStyle={{ color: '#52c41a' }}
              prefix="₹"
              suffix={
                <Tag color="green">{data.ccbCount || 0} txns</Tag>
              }
            />
          </Card>
        </Col>
        
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Variance"
              value={Math.abs(data.variance || 0)}
              precision={2}
              valueStyle={{ color: getVarianceColor(data.variance || 0) }}
              prefix={data.variance >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
              suffix="₹"
            />
          </Card>
        </Col>
        
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Reconciliation Rate"
              value={parseFloat(reconciliationEfficiency)}
              precision={1}
              valueStyle={{ 
                color: parseFloat(reconciliationEfficiency) >= 95 ? '#52c41a' : '#faad14' 
              }}
              suffix="%"
              prefix={
                parseFloat(reconciliationEfficiency) >= 95 
                  ? <CheckCircleOutlined /> 
                  : <ExclamationCircleOutlined />
              }
            />
            <Progress 
              percent={parseFloat(reconciliationEfficiency)} 
              showInfo={false} 
              strokeColor={parseFloat(reconciliationEfficiency) >= 95 ? '#52c41a' : '#faad14'}
              style={{ marginTop: 8 }}
            />
          </Card>
        </Col>
      </Row>

      {/* Charts Row */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card 
            title="Payment Amount Comparison by Mode" 
            loading={loading}
            style={{ height: 400 }}
          >
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={barChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="paymentMode" 
                  angle={-45}
                  textAnchor="end"
                  height={100}
                  fontSize={12}
                />
                <YAxis 
                  tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}K`}
                />
                <Tooltip 
                  formatter={(value, name) => [
                    formatCurrency(Number(value)), 
                    name === 'corportal' ? 'CORPORTAL' : 'CCB'
                  ]}
                  labelFormatter={(label) => `Payment Mode: ${label}`}
                />
                <Legend />
                <Bar 
                  dataKey="corportal" 
                  fill="#1890ff" 
                  name="CORPORTAL"
                  radius={[2, 2, 0, 0]}
                />
                <Bar 
                  dataKey="ccb" 
                  fill="#52c41a" 
                  name="CCB"
                  radius={[2, 2, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        
        <Col xs={24} lg={8}>
          <Card 
            title="Reconciliation Status Distribution" 
            loading={loading}
            style={{ height: 400 }}
          >
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 1).toFixed(1)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value) => [`${value} transactions`, 'Count']}
                />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      {/* Payment Mode Details Table */}
      <Row style={{ marginTop: 16 }}>
        <Col span={24}>
          <Card title="Payment Mode Breakdown" loading={loading}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#fafafa' }}>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #f0f0f0' }}>
                      Payment Mode
                    </th>
                    <th style={{ padding: '12px', textAlign: 'right', borderBottom: '1px solid #f0f0f0' }}>
                      CORPORTAL Amount
                    </th>
                    <th style={{ padding: '12px', textAlign: 'right', borderBottom: '1px solid #f0f0f0' }}>
                      CCB Amount
                    </th>
                    <th style={{ padding: '12px', textAlign: 'right', borderBottom: '1px solid #f0f0f0' }}>
                      Variance
                    </th>
                    <th style={{ padding: '12px', textAlign: 'right', borderBottom: '1px solid #f0f0f0' }}>
                      CORPORTAL Count
                    </th>
                    <th style={{ padding: '12px', textAlign: 'right', borderBottom: '1px solid #f0f0f0' }}>
                      CCB Count
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {barChartData.map((row, index) => (
                    <tr key={index}>
                      <td style={{ padding: '12px', borderBottom: '1px solid #f0f0f0' }}>
                        {row.paymentMode}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right', borderBottom: '1px solid #f0f0f0' }}>
                        {formatCurrency(row.corportal)}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right', borderBottom: '1px solid #f0f0f0' }}>
                        {formatCurrency(row.ccb)}
                      </td>
                      <td style={{ 
                        padding: '12px', 
                        textAlign: 'right', 
                        borderBottom: '1px solid #f0f0f0',
                        color: getVarianceColor(row.variance)
                      }}>
                        {formatCurrency(row.variance)}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right', borderBottom: '1px solid #f0f0f0' }}>
                        {row.corportalCount}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right', borderBottom: '1px solid #f0f0f0' }}>
                        {row.ccbCount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default ReconciliationSummaryChart;