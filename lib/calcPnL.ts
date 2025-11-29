import { ethers } from 'ethers';
import { BaseAppPostTransaction } from './detectBaseAppPost';
import { PriceData } from './getPostPrice';
import { WalletData, Transaction } from './wallet';

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
  isAuthorToken?: boolean; // Токен от собственного поста
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
  // Сегментированная статистика
  authorTokens: {
    count: number;
    totalReceived: string; // Общая сумма полученных токенов (не затраты)
    totalSold: string; // Общая сумма проданных токенов (профит)
    currentBalance: string; // Текущий остаток
    profit: string; // Профит от продаж (totalSold - 0, так как получены бесплатно)
  };
  purchasedTokens: {
    count: number;
    totalInvested: string; // Общая сумма вложений (покупки)
    totalSold: string; // Общая сумма от продаж
    currentBalance: string; // Текущий остаток
    profit: string; // Профит/убыток (totalSold + currentValue - totalInvested)
    loss: string; // Убыток (если profit < 0)
  };
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
    tokenDecimals: number = 18,
    isAuthorToken: boolean = false
  ): Promise<PostAnalytics> {
    const buys = posts.filter((p) => p.type === 'buy' || p.type === 'mint');
    const sells = posts.filter((p) => p.type === 'sell');

    // Calculate total bought (in ETH paid)
    // Для авторских токенов: mint не считается затратой, только покупки других
    let totalCostETH = 0n;
    let totalTokensBought = 0n;

    for (const buy of buys) {
      // Для авторских токенов: mint не считается затратой
      if (isAuthorToken && buy.type === 'mint') {
        // Токены от собственного поста получены бесплатно
        if (buy.amount) {
          totalTokensBought += BigInt(buy.amount);
        }
        continue;
      }
      
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
    // Для авторских токенов: initialValue = 0 (получены бесплатно)
    // This is the cost of the tokens that are still held
    const initialValueNum = isAuthorToken ? 0 : balanceNum * avgPriceUSD;
    
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
      isAuthorToken,
    };
  }

  /**
   * Определяет, является ли токен авторским (создан пользователем)
   * Проверяет транзакции создания токена (mint) от адреса пользователя
   */
  private isAuthorToken(
    tokenAddress: string,
    userAddress: string,
    transactions: Transaction[]
  ): boolean {
    const userAddressLower = userAddress.toLowerCase();
    const tokenAddressLower = tokenAddress.toLowerCase();
    
    // Ищем транзакции создания токена (mint) от пользователя
    // Обычно это транзакции, где from = userAddress и to = tokenAddress или контракт создания
    for (const tx of transactions) {
      const txFrom = tx.from?.toLowerCase();
      const txTo = tx.to?.toLowerCase();
      
      // Проверяем, является ли пользователь создателем токена
      // Это может быть транзакция создания поста в Base App
      if (txFrom === userAddressLower) {
        // Если есть транзакция mint или создания токена от пользователя
        // и она связана с этим токеном
        if (txTo === tokenAddressLower || 
            tx.methodId === '0x40c10f19' || // safeMint
            tx.methodId === '0x1249c58b') { // mint
          return true;
        }
      }
    }
    
    return false;
  }

  calculatePortfolioAnalytics(
    postsAnalytics: PostAnalytics[],
    userAddress?: string,
    walletData?: WalletData
  ): PortfolioAnalytics {
    let totalInvested = 0;
    let totalCurrentValue = 0;
    let profitablePosts = 0;
    let losingPosts = 0;

    // Разделяем на авторские и купленные токены
    const authorTokens: PostAnalytics[] = [];
    const purchasedTokens: PostAnalytics[] = [];

    for (const post of postsAnalytics) {
      // Определяем, является ли токен авторским
      let isAuthor = post.isAuthorToken;
      if (isAuthor === undefined && userAddress && walletData) {
        isAuthor = this.isAuthorToken(post.postTokenAddress, userAddress, walletData.transactions);
      }

      if (isAuthor) {
        authorTokens.push(post);
      } else {
        purchasedTokens.push(post);
      }

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

    // Расчет статистики для авторских токенов
    let authorTotalReceived = 0; // Общая сумма полученных токенов (не затраты)
    let authorTotalSold = 0; // Общая сумма проданных токенов (профит)
    let authorCurrentBalance = 0; // Текущий остаток

    for (const post of authorTokens) {
      const balance = parseFloat(post.currentValue);
      // totalSold уже в токенах, нужно умножить на текущую цену для получения USD
      const soldTokens = parseFloat(post.totalSold);
      const currentPrice = parseFloat(post.currentPrice);
      const sold = soldTokens * currentPrice;
      authorTotalReceived += balance + sold; // Все полученные токены
      authorTotalSold += sold;
      authorCurrentBalance += balance;
      
      console.log(`Author token ${post.postTokenAddress.slice(0, 10)}...: balance=$${balance.toFixed(2)}, sold=$${sold.toFixed(2)}, price=$${currentPrice.toFixed(6)}`);
    }

    const authorProfit = authorTotalSold; // Профит = все проданное (получено бесплатно)

    // Расчет статистики для купленных токенов
    let purchasedTotalInvested = 0; // Общая сумма вложений
    let purchasedTotalSold = 0; // Общая сумма от продаж
    let purchasedCurrentBalance = 0; // Текущий остаток

    for (const post of purchasedTokens) {
      const invested = parseFloat(post.initialValue);
      const current = parseFloat(post.currentValue);
      // totalSold уже в токенах, нужно умножить на текущую цену для получения USD
      const soldTokens = parseFloat(post.totalSold);
      const currentPrice = parseFloat(post.currentPrice);
      const sold = soldTokens * currentPrice;
      
      purchasedTotalInvested += invested;
      purchasedTotalSold += sold;
      purchasedCurrentBalance += current;
      
      console.log(`Purchased token ${post.postTokenAddress.slice(0, 10)}...: invested=$${invested.toFixed(2)}, current=$${current.toFixed(2)}, sold=$${sold.toFixed(2)}, price=$${currentPrice.toFixed(6)}`);
    }

    const purchasedProfit = purchasedTotalSold + purchasedCurrentBalance - purchasedTotalInvested;
    const purchasedLoss = purchasedProfit < 0 ? Math.abs(purchasedProfit) : 0;
    const purchasedProfitFinal = purchasedProfit > 0 ? purchasedProfit : 0;

    const totalPnL = totalCurrentValue - totalInvested;
    const totalPnLPct = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;
    
    console.log(`\n=== Portfolio Summary ===`);
    console.log(`Total invested: $${totalInvested.toFixed(2)}`);
    console.log(`Total current value: $${totalCurrentValue.toFixed(2)}`);
    console.log(`Total PnL: $${totalPnL.toFixed(2)} (${totalPnLPct.toFixed(2)}%)`);
    console.log(`Author tokens: ${authorTokens.length}, Profit: $${authorProfit.toFixed(2)}`);
    console.log(`Purchased tokens: ${purchasedTokens.length}, Profit: $${purchasedProfitFinal.toFixed(2)}, Loss: $${purchasedLoss.toFixed(2)}`);

    return {
      posts: postsAnalytics,
      totalInvested: totalInvested.toString(),
      totalCurrentValue: totalCurrentValue.toString(),
      totalPnL: totalPnL.toString(),
      totalPnLPct,
      countOfPostTokens: postsAnalytics.length,
      profitablePosts,
      losingPosts,
      authorTokens: {
        count: authorTokens.length,
        totalReceived: authorTotalReceived.toFixed(2),
        totalSold: authorTotalSold.toFixed(2),
        currentBalance: authorCurrentBalance.toFixed(2),
        profit: authorProfit.toFixed(2),
      },
      purchasedTokens: {
        count: purchasedTokens.length,
        totalInvested: purchasedTotalInvested.toFixed(2),
        totalSold: purchasedTotalSold.toFixed(2),
        currentBalance: purchasedCurrentBalance.toFixed(2),
        profit: purchasedProfitFinal.toFixed(2),
        loss: purchasedLoss.toFixed(2),
      },
    };
  }
}

