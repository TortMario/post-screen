import React, { useState } from 'react';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { PortfolioAnalytics, PostAnalytics } from '@/lib/calcPnL';

interface PortfolioChartProps {
  portfolio: PortfolioAnalytics;
}

export default function PortfolioChart({ portfolio }: PortfolioChartProps) {
  const [timeRange, setTimeRange] = useState<'30d' | '1y' | 'all'>('all');

  // Generate mock historical data for visualization
  const generateHistoricalData = () => {
    const data = [];
    const now = Date.now();
    const days = timeRange === '30d' ? 30 : timeRange === '1y' ? 365 : 730;
    
    let cumulativeValue = parseFloat(portfolio.totalInvested);
    const targetValue = parseFloat(portfolio.totalCurrentValue);
    const startValue = cumulativeValue * 0.8; // Start 20% lower
    
    for (let i = days; i >= 0; i--) {
      const date = new Date(now - i * 24 * 60 * 60 * 1000);
      const progress = (days - i) / days;
      
      // Simulate value growth with some volatility
      const volatility = (Math.random() - 0.5) * 0.1;
      const value = startValue + (targetValue - startValue) * progress + volatility * cumulativeValue;
      
      // Calculate PnL percentage
      const pnl = ((value - cumulativeValue) / cumulativeValue) * 100;
      
      data.push({
        date: date.toISOString().split('T')[0],
        timestamp: date.getTime(),
        value: Math.max(value, 0),
        pnl: pnl,
        invested: cumulativeValue,
      });
    }
    
    return data;
  };

  const chartData = generateHistoricalData();

  const formatCurrency = (value: number) => {
    return `$${value.toFixed(2)}`;
  };

  const formatDate = (date: string) => {
    const d = new Date(date);
    return timeRange === '30d' 
      ? `${d.getMonth() + 1}/${d.getDate()}`
      : `${d.getMonth() + 1}/${d.getFullYear()}`;
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Portfolio Performance</h2>
        <div className="flex gap-2">
          {(['30d', '1y', 'all'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                timeRange === range
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10 border border-white/10'
              }`}
            >
              {range === 'all' ? 'All' : range.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="h-80 w-full min-h-[320px] min-w-[0]">
        <ResponsiveContainer width="100%" height="100%" minHeight={320} minWidth={0}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="valueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="pnlGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              stroke="rgba(255, 255, 255, 0.5)"
              style={{ fontSize: '12px' }}
            />
            <YAxis
              yAxisId="value"
              tickFormatter={formatCurrency}
              stroke="rgba(255, 255, 255, 0.5)"
              style={{ fontSize: '12px' }}
            />
            <YAxis
              yAxisId="pnl"
              orientation="right"
              tickFormatter={(value) => `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`}
              stroke="rgba(255, 255, 255, 0.5)"
              style={{ fontSize: '12px' }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(13, 15, 20, 0.95)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                color: '#fff',
              }}
              formatter={(value: any, name: string) => {
                if (name === 'value') return formatCurrency(value);
                if (name === 'pnl') return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
                return value;
              }}
              labelFormatter={(label) => `Date: ${formatDate(label)}`}
            />
            
            {/* PnL Line */}
            <Line
              yAxisId="pnl"
              type="monotone"
              dataKey="pnl"
              stroke="#10b981"
              strokeWidth={2}
              dot={false}
              name="PnL %"
            />
            
            {/* Value Area */}
            <Area
              yAxisId="value"
              type="monotone"
              dataKey="value"
              stroke="#3b82f6"
              strokeWidth={2}
              fill="url(#valueGradient)"
              name="Portfolio Value"
            />
            
            {/* Zero line for PnL */}
            <ReferenceLine yAxisId="pnl" y={0} stroke="rgba(255, 255, 255, 0.3)" strokeDasharray="2 2" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex justify-center gap-6 mt-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-0.5 bg-blue-400"></div>
          <span className="text-gray-400">Portfolio Value</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-0.5 bg-green-400"></div>
          <span className="text-gray-400">PnL %</span>
        </div>
      </div>
    </div>
  );
}

