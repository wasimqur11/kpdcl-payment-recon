import React, { useState } from 'react';
import { Card, Select, Row, Col } from 'antd';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar
} from 'recharts';
import { PaymentTrends, PAYMENT_MODES } from '../../types';
import { formatCurrency, formatDate } from '../../services/api';
import moment from 'moment';

interface PaymentTrendsChartProps {
  data: PaymentTrends;
  loading?: boolean;
}

const { Option } = Select;

const PaymentTrendsChart: React.FC<PaymentTrendsChartProps> = ({ 
  data, 
  loading = false 
}) => {
  const [chartType, setChartType] = useState<'line' | 'area' | 'bar'>('line');
  const [viewMode, setViewMode] = useState<'daily' | 'paymentMode'>('daily');

  // Prepare daily trends data
  const dailyTrendsData = data.corportalVsCCB?.map(trend => ({
    ...trend,
    date: formatDate(trend.date),
    formattedDate: moment(trend.date).format('MMM DD'),
    variancePercent: trend.corportal > 0 
      ? ((trend.variance / trend.corportal) * 100).toFixed(2)
      : 0
  })) || [];

  // Prepare payment mode comparison data
  const paymentModeData = Object.entries(data.byPaymentMode || {}).map(([mode, values]) => ({
    paymentMode: PAYMENT_MODES[mode as keyof typeof PAYMENT_MODES] || mode,
    shortMode: mode.replace(/_/g, ' '),
    corportal: values.corportal.amount,
    ccb: values.ccb.amount,
    variance: values.corportal.amount - values.ccb.amount,
    corportalCount: values.corportal.count,
    ccbCount: values.ccb.count
  }));

  const renderChart = () => {
    const chartData = viewMode === 'daily' ? dailyTrendsData : paymentModeData;
    const dataKey = viewMode === 'daily' ? 'formattedDate' : 'shortMode';
    
    const commonProps = {
      data: chartData,
      margin: { top: 5, right: 30, left: 20, bottom: 5 }
    };

    switch (chartType) {
      case 'area':
        return (
          <AreaChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey={dataKey}
              angle={viewMode === 'paymentMode' ? -45 : 0}
              textAnchor={viewMode === 'paymentMode' ? 'end' : 'middle'}
              height={viewMode === 'paymentMode' ? 80 : 60}
            />
            <YAxis tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}K`} />
            <Tooltip 
              formatter={(value, name) => [
                formatCurrency(Number(value)), 
                name === 'corportal' ? 'CORPORTAL' : 'CCB'
              ]}
              labelFormatter={(label) => 
                viewMode === 'daily' ? `Date: ${label}` : `Mode: ${label}`
              }
            />
            <Legend />
            <Area
              type="monotone"
              dataKey="corportal"
              stackId="1"
              stroke="#1890ff"
              fill="#1890ff"
              fillOpacity={0.6}
              name="CORPORTAL"
            />
            <Area
              type="monotone"
              dataKey="ccb"
              stackId="2"
              stroke="#52c41a"
              fill="#52c41a"
              fillOpacity={0.6}
              name="CCB"
            />
          </AreaChart>
        );
      
      case 'bar':
        return (
          <BarChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey={dataKey}
              angle={viewMode === 'paymentMode' ? -45 : 0}
              textAnchor={viewMode === 'paymentMode' ? 'end' : 'middle'}
              height={viewMode === 'paymentMode' ? 80 : 60}
            />
            <YAxis tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}K`} />
            <Tooltip 
              formatter={(value, name) => [
                formatCurrency(Number(value)), 
                name === 'corportal' ? 'CORPORTAL' : 'CCB'
              ]}
              labelFormatter={(label) => 
                viewMode === 'daily' ? `Date: ${label}` : `Mode: ${label}`
              }
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
        );
      
      default: // line
        return (
          <LineChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey={dataKey}
              angle={viewMode === 'paymentMode' ? -45 : 0}
              textAnchor={viewMode === 'paymentMode' ? 'end' : 'middle'}
              height={viewMode === 'paymentMode' ? 80 : 60}
            />
            <YAxis tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}K`} />
            <Tooltip 
              formatter={(value, name) => [
                formatCurrency(Number(value)), 
                name === 'corportal' ? 'CORPORTAL' : 'CCB'
              ]}
              labelFormatter={(label) => 
                viewMode === 'daily' ? `Date: ${label}` : `Mode: ${label}`
              }
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="corportal"
              stroke="#1890ff"
              strokeWidth={2}
              dot={{ fill: '#1890ff', strokeWidth: 2, r: 4 }}
              name="CORPORTAL"
            />
            <Line
              type="monotone"
              dataKey="ccb"
              stroke="#52c41a"
              strokeWidth={2}
              dot={{ fill: '#52c41a', strokeWidth: 2, r: 4 }}
              name="CCB"
            />
            {viewMode === 'daily' && (
              <Line
                type="monotone"
                dataKey="variance"
                stroke="#faad14"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ fill: '#faad14', strokeWidth: 2, r: 3 }}
                name="Variance"
              />
            )}
          </LineChart>
        );
    }
  };

  return (
    <Row gutter={[16, 16]}>
      <Col span={24}>
        <Card 
          title="Payment Trends Analysis"
          loading={loading}
          extra={
            <div style={{ display: 'flex', gap: 8 }}>
              <Select
                value={viewMode}
                onChange={setViewMode}
                style={{ width: 120 }}
              >
                <Option value="daily">Daily View</Option>
                <Option value="paymentMode">By Mode</Option>
              </Select>
              
              <Select
                value={chartType}
                onChange={setChartType}
                style={{ width: 100 }}
              >
                <Option value="line">Line</Option>
                <Option value="area">Area</Option>
                <Option value="bar">Bar</Option>
              </Select>
            </div>
          }
        >
          <ResponsiveContainer width="100%" height={400}>
            {renderChart()}
          </ResponsiveContainer>
        </Card>
      </Col>
      
      {/* Variance Analysis for Daily View */}
      {viewMode === 'daily' && (
        <Col span={24}>
          <Card title="Daily Variance Analysis" loading={loading}>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={dailyTrendsData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="formattedDate" />
                <YAxis tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}K`} />
                <Tooltip 
                  formatter={(value) => [formatCurrency(Number(value)), 'Variance']}
                  labelFormatter={(label) => `Date: ${label}`}
                />
                <Area
                  type="monotone"
                  dataKey="variance"
                  stroke="#faad14"
                  fill="#faad14"
                  fillOpacity={0.3}
                  name="Daily Variance"
                />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      )}
      
      {/* Summary Statistics */}
      <Col span={24}>
        <Card title="Trend Summary" loading={loading}>
          <Row gutter={16}>
            <Col xs={24} sm={8}>
              <div style={{ textAlign: 'center', padding: '16px' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1890ff' }}>
                  {dailyTrendsData.length}
                </div>
                <div style={{ color: '#666' }}>Days Analyzed</div>
              </div>
            </Col>
            
            <Col xs={24} sm={8}>
              <div style={{ textAlign: 'center', padding: '16px' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#52c41a' }}>
                  {formatCurrency(
                    dailyTrendsData.reduce((sum, day) => sum + Math.abs(day.variance), 0) / 
                    (dailyTrendsData.length || 1)
                  ).replace('₹', '')}
                </div>
                <div style={{ color: '#666' }}>Avg Daily Variance</div>
              </div>
            </Col>
            
            <Col xs={24} sm={8}>
              <div style={{ textAlign: 'center', padding: '16px' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#faad14' }}>
                  {paymentModeData.length}
                </div>
                <div style={{ color: '#666' }}>Payment Modes</div>
              </div>
            </Col>
          </Row>
        </Card>
      </Col>
    </Row>
  );
};

export default PaymentTrendsChart;