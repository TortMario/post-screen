import React from 'react';
import { PortfolioAnalytics } from '@/lib/calcPnL';

interface PortfolioCardProps {
  portfolio: PortfolioAnalytics;
}

export default function PortfolioCard({ portfolio }: PortfolioCardProps) {
  const totalPnL = parseFloat(portfolio.totalPnL);
  const totalPnLPct = portfolio.totalPnLPct;
  const isPositive = totalPnL >= 0;

  // Calculate PnL percentage for gauge (0-100 scale, centered at 50%)
  const pnlGaugeValue = Math.min(Math.max(totalPnLPct + 50, 0), 100);
  const radius = 70; // Smaller radius for smaller circle
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pnlGaugeValue / 100) * circumference;

  // Color gradients based on PnL
  const gaugeColor = isPositive 
    ? 'url(#greenGradient)' 
    : 'url(#redGradient)';
  const textGradient = isPositive
    ? 'from-green-400 to-emerald-300'
    : 'from-red-400 to-rose-300';

  return (
    <div className="space-y-8">
      {/* Main PnL Gauge with enhanced design */}
      <div className="text-center">
        <div className="relative inline-block w-48 h-48">
          <svg className="transform -rotate-90 w-48 h-48 drop-shadow-2xl">
            <defs>
              <linearGradient id="greenGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#00c853" stopOpacity="1" />
                <stop offset="100%" stopColor="#4caf50" stopOpacity="1" />
              </linearGradient>
              <linearGradient id="redGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ff1744" stopOpacity="1" />
                <stop offset="100%" stopColor="#ff6b6b" stopOpacity="1" />
              </linearGradient>
              <filter id="glow">
                <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>
            
            {/* Background circle */}
            <circle
              cx="96"
              cy="96"
              r="70"
              stroke="rgba(255, 255, 255, 0.1)"
              strokeWidth="10"
              fill="none"
            />
            
            {/* Progress circle with gradient */}
            <circle
              cx="96"
              cy="96"
              r="70"
              stroke={isPositive ? '#00c853' : '#ff1744'}
              strokeWidth="10"
              fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
              className="transition-all duration-1000 ease-out"
              style={{ filter: 'url(#glow)' }}
            />
          </svg>
          
          {/* Center content - properly positioned */}
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center w-full">
            <div className={`text-3xl font-bold bg-gradient-to-r ${textGradient} bg-clip-text text-transparent leading-tight`}>
              {totalPnLPct >= 0 ? '+' : ''}{totalPnLPct.toFixed(1)}%
            </div>
            <div className="text-xs text-gray-400 mt-1 font-medium uppercase tracking-wider">PnL</div>
          </div>
        </div>
        
        {/* PnL Amount - separate section */}
        <div className="mt-8">
          <div className={`text-4xl font-bold bg-gradient-to-r ${textGradient} bg-clip-text text-transparent mb-2`}>
            {totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(2)}
          </div>
          <div className="text-sm text-gray-400 font-medium uppercase tracking-wide">Total Profit/Loss</div>
        </div>
      </div>

      {/* Enhanced Stats Grid */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-2xl p-5 border border-blue-500/20 backdrop-blur-sm hover:border-blue-500/40 transition-all duration-200">
          <div className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wide">Total Invested</div>
          <div className="text-xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
            ${parseFloat(portfolio.totalInvested).toFixed(2)}
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-2xl p-5 border border-purple-500/20 backdrop-blur-sm hover:border-purple-500/40 transition-all duration-200">
          <div className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wide">Current Value</div>
          <div className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            ${parseFloat(portfolio.totalCurrentValue).toFixed(2)}
          </div>
        </div>
      </div>
    </div>
  );
}
