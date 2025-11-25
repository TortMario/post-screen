import { ethers } from 'ethers';
import { BaseAppPostTransaction } from './detectBaseAppPost';
import { PriceData } from './getPostPrice';

export interface PostAnalytics {
  postTokenAddress: string;
  postId?: string;
  postName?: string;
  balance: string;
  balanceFormatted: string;
  totalBought: string;
  totalSold: string;
  averageBuyPrice: string;
  currentPrice: string;
  initialValue: string;
  currentValue: string;
  pnl: string;
  pnlPct: number;
  buyCount: number;
  sellCount: number;
  firstBuyDate?: number;
  lastActivityDate?: number;
}

export interface PortfolioAnalytics {
  posts: PostAnalytics[];
  totalInvested: string;
  totalCurrentValue: string;
  totalPnL: string;
  totalPnLPct: number;
  countOfPostTokens: number;
  profitablePosts: number;
  losingPosts: number;
}

export class PnLCalculator {
  private coinGeckoApiKey?: string;

  constructor(coinGeckoApiKey?: string) {
    this.coinGeckoApiKey = coinGeckoApiKey;
  }

  private async getETHPrice(): Promise<number> {
    // Use CoinGecko (with API key if provided)
    try {
      const apiKeyParam = this.coinGeckoApiKey ? `&x_cg_demo_api_key=${this.coinGeckoApiKey}` : '';
      const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd${apiKeyParam}`);
      const data = await res.json();
      const price = data?.ethereum?.usd;
      if (price && parseFloat(price) > 0) {
        return parseFloat(price);
      }
    } catch (e) {
      console.warn('CoinGecko ETH price API failed:', e);
    }
    
    return 3000; // Fallback
  }

  async calculatePostAnalytics(
    posts: BaseAppPostTransaction[],
    balance: string,
    currentPrice: PriceData,
    tokenDecimals: number = 18
  ): PostAnalytics {
    const buys = posts.filter((p) => p.type === 'buy' || p.type === 'mint');
    const sells = posts.filter((p) => p.type === 'sell');

    // Calculate total bought (in ETH paid)
    let totalCostETH = 0n;
    let totalTokensBought = 0n;

    for (const buy of buys) {
      // price is ETH paid (in wei)
      const ethPaid = BigInt(buy.price || '0');
      totalCostETH += ethPaid;
      
      // amount is tokens received (in smallest token units)
      if (buy.amount) {
        totalTokensBought += BigInt(buy.amount);
      }
    }

    // Calculate total sold
    let totalSold = 0n;
    let totalRevenue = 0n;

    for (const sell of sells) {
      if (sell.amount) {
        totalSold += BigInt(sell.amount);
      }
      const ethReceived = BigInt(sell.price || '0');
      totalRevenue += ethReceived;
    }

    // Current balance - convert from formatted string to token units
    const currentBalanceFormatted = parseFloat(balance || '0');
    const currentBalanceWei = ethers.parseUnits(currentBalanceFormatted.toFixed(tokenDecimals), tokenDecimals);

    // Average buy price per token (in ETH, from transaction value)
    // totalTokensBought is in smallest token units
    // totalCostETH is in wei (ETH paid)
    const averageBuyPriceWei = totalTokensBought > 0n 
      ? (totalCostETH * ethers.parseEther('1')) / totalTokensBought
      : 0n;
    const avgPriceETH = parseFloat(ethers.formatEther(averageBuyPriceWei));

    // Current price from API
    const currentPriceNum = parseFloat(currentPrice.price);
    
    // Get ETH/USD price for conversion
    const ETH_USD_PRICE = await this.getETHPrice();
    
    // Convert average buy price from ETH to USD
    const avgPriceUSD = avgPriceETH * ETH_USD_PRICE;
    
    // Current price: if isUSD flag is set, it's already in USD, otherwise convert from ETH
    const currentPriceUSD = (currentPrice as any).isUSD 
      ? currentPriceNum 
      : currentPriceNum * ETH_USD_PRICE;

    // Calculate values in USD
    // Convert token balance to human-readable format
    const balanceNum = parseFloat(balance);
    
    // initialValue = current balance * averageBuyPriceUSD (cost basis for remaining tokens)
    // This is the cost of the tokens that are still held
    const initialValueNum = balanceNum * avgPriceUSD;
    
    // currentValue = balance * currentPriceUSD (current market value)
    const currentValueNum = balanceNum * currentPriceUSD;

    // PnL = current value - initial cost
    // Positive if current > initial (profit), negative if current < initial (loss)
    const pnlNum = currentValueNum - initialValueNum;
    const pnlPct = initialValueNum > 0 ? (pnlNum / initialValueNum) * 100 : 0;
    
    // Debug logging
    console.log(`  PnL calculation for token:`);
    console.log(`    Balance: ${balanceNum}`);
    console.log(`    Avg buy price (USD): ${avgPriceUSD.toFixed(6)}`);
    console.log(`    Current price (USD): ${currentPriceUSD.toFixed(6)}`);
    console.log(`    Initial value: $${initialValueNum.toFixed(2)}`);
    console.log(`    Current value: $${currentValueNum.toFixed(2)}`);
    console.log(`    PnL: $${pnlNum.toFixed(2)} (${pnlPct.toFixed(2)}%)`);

    const firstBuyDate = buys.length > 0 ? Math.min(...buys.map((b) => b.timestamp)) : undefined;
    const lastActivityDate =
      posts.length > 0 ? Math.max(...posts.map((p) => p.timestamp)) : undefined;

    // Format token amounts
    const totalBoughtFormatted = ethers.formatUnits(totalTokensBought, tokenDecimals);
    const totalSoldFormatted = ethers.formatUnits(totalSold, tokenDecimals);

    return {
      postTokenAddress: posts[0]?.postTokenAddress || '',
      postId: posts[0]?.postId,
      balance: currentBalanceWei.toString(),
      balanceFormatted: balance,
      totalBought: totalBoughtFormatted,
      totalSold: totalSoldFormatted,
      averageBuyPrice: avgPriceUSD.toFixed(6), // In USD
      currentPrice: currentPriceUSD.toFixed(6), // In USD
      initialValue: initialValueNum.toFixed(2), // In USD
      currentValue: currentValueNum.toFixed(2), // In USD
      pnl: pnlNum.toFixed(2), // In USD
      pnlPct,
      buyCount: buys.length,
      sellCount: sells.length,
      firstBuyDate,
      lastActivityDate,
    };
  }

  calculatePortfolioAnalytics(postsAnalytics: PostAnalytics[]): PortfolioAnalytics {
    let totalInvested = 0;
    let totalCurrentValue = 0;
    let profitablePosts = 0;
    let losingPosts = 0;

    for (const post of postsAnalytics) {
      const invested = parseFloat(post.initialValue);
      const current = parseFloat(post.currentValue);

      totalInvested += invested;
      totalCurrentValue += current;

      if (parseFloat(post.pnl) > 0) {
        profitablePosts++;
      } else if (parseFloat(post.pnl) < 0) {
        losingPosts++;
      }
    }

    const totalPnL = totalCurrentValue - totalInvested;
    const totalPnLPct = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;

    return {
      posts: postsAnalytics,
      totalInvested: totalInvested.toString(),
      totalCurrentValue: totalCurrentValue.toString(),
      totalPnL: totalPnL.toString(),
      totalPnLPct,
      countOfPostTokens: postsAnalytics.length,
      profitablePosts,
      losingPosts,
    };
  }
}

