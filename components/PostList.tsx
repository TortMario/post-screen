import React from 'react';
import { PostAnalytics } from '@/lib/calcPnL';

interface PostListProps {
  posts: PostAnalytics[];
}

export default function PostList({ posts }: PostListProps) {
  if (posts.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <p>No BaseApp posts found in your wallet</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {posts.map((post, index) => {
        const isPositive = post.pnlPct >= 0;
        const pnlColor = isPositive ? 'text-green-400' : 'text-red-400';
        const pnlBg = isPositive 
          ? 'bg-gradient-to-r from-green-500/20 to-emerald-500/20' 
          : 'bg-gradient-to-r from-red-500/20 to-rose-500/20';
        const pnlBorder = isPositive 
          ? 'border-green-500/50 shadow-green-500/20' 
          : 'border-red-500/50 shadow-red-500/20';
        const cardGradient = isPositive
          ? 'from-green-500/5 via-transparent to-transparent'
          : 'from-red-500/5 via-transparent to-transparent';

        return (
          <div
            key={index}
            className={`relative bg-gradient-to-br ${cardGradient} backdrop-blur-md rounded-2xl p-6 border ${pnlBorder} hover:shadow-lg hover:scale-[1.02] transition-all duration-300 overflow-hidden`}
          >
            {/* Animated background gradient */}
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-pink-500/5 opacity-50"></div>
            
            <div className="relative z-10">
              <div className="flex justify-between items-start mb-5">
                <div className="flex-1">
                  <h3 className="text-xl font-bold mb-2 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                    {post.postName || `${post.postTokenAddress.slice(0, 8)}...${post.postTokenAddress.slice(-6)}`}
                  </h3>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-400">
                      Balance: <span className="text-white font-semibold">{parseFloat(post.balanceFormatted).toFixed(4)}</span>
                    </span>
                  </div>
                </div>
                <div className={`px-4 py-2 rounded-xl font-bold text-lg shadow-lg ${pnlBg} ${pnlColor} border ${pnlBorder}`}>
                  {post.pnlPct >= 0 ? '+' : ''}{post.pnlPct.toFixed(2)}%
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-5">
                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <div className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wide">Avg Buy</div>
                  <div className="text-base font-bold text-blue-300">
                    ${parseFloat(post.averageBuyPrice).toFixed(6)}
                  </div>
                </div>
                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <div className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wide">Current</div>
                  <div className="text-base font-bold text-purple-300">
                    ${parseFloat(post.currentPrice).toFixed(6)}
                  </div>
                </div>
                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <div className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wide">Initial Value</div>
                  <div className="text-base font-bold">
                    ${parseFloat(post.initialValue).toFixed(2)}
                  </div>
                </div>
                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <div className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wide">Current Value</div>
                  <div className="text-base font-bold">
                    ${parseFloat(post.currentValue).toFixed(2)}
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center text-sm mb-3">
                <span className="text-gray-400">
                  PnL: <span className={`font-bold ${pnlColor}`}>{parseFloat(post.pnl) >= 0 ? '+' : ''}${parseFloat(post.pnl).toFixed(2)}</span>
                </span>
                <span className="text-gray-400">
                  <span className="text-blue-400 font-semibold">{post.buyCount}</span> buys • <span className="text-purple-400 font-semibold">{post.sellCount}</span> sells
                </span>
              </div>

              {/* Enhanced PnL Bar */}
              <div className="relative w-full h-3 bg-white/10 rounded-full overflow-hidden backdrop-blur-sm">
                <div
                  className={`h-full transition-all duration-700 ease-out relative ${
                    isPositive 
                      ? 'bg-gradient-to-r from-green-500 via-emerald-400 to-green-300' 
                      : 'bg-gradient-to-r from-red-500 via-rose-400 to-red-300'
                  }`}
                  style={{ width: `${Math.min(Math.abs(post.pnlPct), 100)}%` }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"></div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
