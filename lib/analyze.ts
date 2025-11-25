import { WalletService, WalletData, Transaction, TokenBalance } from './wallet';
import { BaseAppPostTransaction } from './detectBaseAppPost';
import { PostPriceService, PriceData } from './getPostPrice';
import { PnLCalculator, PostAnalytics, PortfolioAnalytics } from './calcPnL';
import { BaseAppDetector } from './baseAppDetector';
import { enrichTokensWithDexScreener } from './findTokensViaDexScreener';

export interface AnalysisResult {
  wallet: WalletData;
  portfolio: PortfolioAnalytics;
}

export class AnalyticsService {
  private walletService: WalletService;
  private priceService: PostPriceService;
  private pnlCalculator: PnLCalculator;
  private baseAppDetector: BaseAppDetector;

  constructor(baseScanApiKey?: string, coinGeckoApiKey?: string) {
    this.walletService = new WalletService(baseScanApiKey);
    this.priceService = new PostPriceService(coinGeckoApiKey);
    this.pnlCalculator = new PnLCalculator(coinGeckoApiKey);
    this.baseAppDetector = new BaseAppDetector();
  }

  async analyzeWallet(address: string): Promise<AnalysisResult> {
    console.log('=== Starting wallet analysis ===');
    console.log('Wallet address:', address);
    console.log('Has API key:', !!this.walletService.baseScanApiKey);
    console.log('API key length:', this.walletService.baseScanApiKey?.length || 0);
    
    try {
      // Get wallet data
      const walletData = await this.walletService.getWalletData(address);

      console.log(`Found ${walletData.tokens.length} tokens in wallet`);
      console.log(`Found ${walletData.transactions.length} transactions`);
      
      if (walletData.tokens.length === 0) {
        console.warn('⚠️ No tokens found! This might indicate:');
        console.warn('1. API rate limiting');
        console.warn('2. Invalid API key');
        console.warn('3. Wallet has no tokens');
        console.warn('4. Network/API issues');
        console.warn('5. Check server logs for detailed API responses');
        
        // Still return empty result instead of failing
        return {
          wallet: walletData,
          portfolio: this.pnlCalculator.calculatePortfolioAnalytics([]),
        };
      }

    // Filter tokens with balance - ONLY analyze tokens that are already in the wallet
    const tokensWithBalance = walletData.tokens.filter(t => parseFloat(t.balanceFormatted) > 0);
    console.log(`Found ${tokensWithBalance.length} tokens with balance > 0 in wallet (out of ${walletData.tokens.length} total)`);

    if (tokensWithBalance.length === 0) {
      console.warn('No tokens with balance found in wallet');
      // Return empty portfolio
      return {
        wallet: walletData,
        portfolio: this.pnlCalculator.calculatePortfolioAnalytics([]),
      };
    }

    // STEP 1: Check which tokens are BaseApp tokens by bytecode (ONLY for tokens in wallet)
    console.log(`\n=== Step 1: Detecting BaseApp Tokens ===`);
    console.log(`Checking ${tokensWithBalance.length} wallet tokens for BaseApp bytecode fingerprint...`);
    console.log(`Token addresses to check:`, tokensWithBalance.slice(0, 10).map(t => t.tokenAddress.slice(0, 10) + '...'));
    if (tokensWithBalance.length > 10) {
      console.log(`... and ${tokensWithBalance.length - 10} more tokens`);
    }
    
    const baseAppTokenAddresses = await this.detectBaseAppTokensByBytecode(tokensWithBalance);
    console.log(`✓ Identified ${baseAppTokenAddresses.size} BaseApp tokens by bytecode (out of ${tokensWithBalance.length} total tokens)`);
    
    if (baseAppTokenAddresses.size > 0) {
      console.log(`BaseApp token addresses found:`, Array.from(baseAppTokenAddresses).slice(0, 10).map(a => a.slice(0, 10) + '...'));
    }

    if (baseAppTokenAddresses.size === 0) {
      console.warn('No BaseApp tokens found in wallet');
      return {
        wallet: walletData,
        portfolio: this.pnlCalculator.calculatePortfolioAnalytics([]),
      };
    }

    // STEP 2: Filter to only BaseApp tokens
    const baseAppTokens = tokensWithBalance.filter(t => 
      baseAppTokenAddresses.has(t.tokenAddress.toLowerCase())
    );
    console.log(`Step 2: Filtered to ${baseAppTokens.length} BaseApp tokens from wallet`);

    // STEP 3: Enrich tokens with DexScreener data (cross-check)
    let dexScreenerData = new Map<string, { hasPrice: boolean; priceUsd?: string }>();
    if (baseAppTokens.length > 0) {
      try {
        console.log(`Step 3a: Cross-checking ${baseAppTokens.length} BaseApp tokens with DexScreener...`);
        dexScreenerData = await enrichTokensWithDexScreener(baseAppTokens);
      } catch (error) {
        console.warn('DexScreener enrichment failed, continuing without it:', error);
      }
    }
    
    // STEP 3b: Get prices for all BaseApp tokens and sort by price
    console.log(`Step 3b: Fetching prices for ${baseAppTokens.length} BaseApp tokens...`);
    const tokensWithPrices = await Promise.all(
      baseAppTokens.map(async (token) => {
        try {
          // Try primary price service first
          const priceData = await this.priceService.getPostPrice(undefined, token.tokenAddress);
          let priceValue = parseFloat(priceData.price || '0');
          
          // If price is 0 or invalid, try DexScreener data as fallback
          if (isNaN(priceValue) || priceValue <= 0) {
            const dexData = dexScreenerData.get(token.tokenAddress.toLowerCase());
            if (dexData?.hasPrice && dexData.priceUsd) {
              priceValue = parseFloat(dexData.priceUsd);
              console.log(`  Using DexScreener price for ${token.symbol}: $${priceValue}`);
            }
          }
          
          return {
            token,
            priceData,
            priceValue: isNaN(priceValue) || priceValue <= 0 ? 0 : priceValue,
          };
        } catch (error) {
          console.warn(`Failed to get price for ${token.symbol}:`, error);
          // Try DexScreener as last resort
          const dexData = dexScreenerData.get(token.tokenAddress.toLowerCase());
          const fallbackPrice = dexData?.priceUsd ? parseFloat(dexData.priceUsd) : 0;
          return {
            token,
            priceData: { price: fallbackPrice.toString(), source: 'dexscreener', timestamp: Date.now() } as any,
            priceValue: fallbackPrice,
          };
        }
      })
    );

    // STEP 4: Filter out tokens with zero price and sort by price (highest first)
    const validTokens = tokensWithPrices
      .filter(t => t.priceValue > 0)
      .sort((a, b) => b.priceValue - a.priceValue); // Sort by price descending

    console.log(`Step 4: Found ${validTokens.length} BaseApp tokens with valid prices (sorted by price)`);
    
    if (validTokens.length === 0) {
      console.warn('No BaseApp tokens with valid prices found');
      return {
        wallet: walletData,
        portfolio: this.pnlCalculator.calculatePortfolioAnalytics([]),
      };
    }

    // STEP 5: Analyze only BaseApp tokens (already sorted by price)
    console.log(`Step 5: Analyzing ${validTokens.length} BaseApp tokens...`);
    const postsAnalytics: PostAnalytics[] = [];

    // Batch process tokens to avoid too many API calls
    const BATCH_SIZE = 3; // Process 3 tokens at a time
    for (let i = 0; i < validTokens.length; i += BATCH_SIZE) {
      const batch = validTokens.slice(i, i + BATCH_SIZE);
      console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(validTokens.length / BATCH_SIZE)} (${batch.length} BaseApp tokens)...`);
      
      const batchPromises = batch.map(({ token }) => this.analyzeToken(token, address, walletData));
      const batchResults = await Promise.allSettled(batchPromises);
      
      for (const result of batchResults) {
        if (result.status === 'fulfilled' && result.value) {
          postsAnalytics.push(result.value);
        } else if (result.status === 'rejected') {
          console.error('Token analysis failed:', result.reason);
        }
      }
      
      console.log(`Batch ${Math.floor(i / BATCH_SIZE) + 1} complete: ${postsAnalytics.length} posts analyzed so far`);
    }

    // Calculate portfolio totals
    const portfolio = this.pnlCalculator.calculatePortfolioAnalytics(postsAnalytics);

    console.log(`Total posts analyzed: ${postsAnalytics.length}`);
    console.log(`Portfolio PnL: ${portfolio.totalPnLPct.toFixed(2)}%`);

    return {
      wallet: walletData,
      portfolio,
    };
    } catch (error: any) {
      console.error('Error in analyzeWallet:', error);
      console.error('Error stack:', error.stack);
      
      // Return empty result instead of throwing
      return {
        wallet: {
          address,
          balance: '0',
          tokens: [],
          transactions: [],
        },
        portfolio: this.pnlCalculator.calculatePortfolioAnalytics([]),
      };
    }
  }

  /**
   * Detect BaseApp tokens by checking their bytecode fingerprint
   * This is the most accurate method - all BaseApp tokens have identical bytecode
   * IMPORTANT: Only checks tokens that are already in the wallet, does NOT scan the network
   */
  private async detectBaseAppTokensByBytecode(tokens: TokenBalance[]): Promise<Set<string>> {
    const baseAppAddresses = new Set<string>();
    
    if (tokens.length === 0) {
      return baseAppAddresses;
    }

    console.log(`Checking bytecode for ${tokens.length} wallet tokens (not scanning network)...`);
    
    // Batch check tokens from wallet only
    const addresses = tokens.map(t => t.tokenAddress);
    const results = await this.baseAppDetector.checkMultipleTokens(addresses);
    
    for (const [address, isBaseApp] of results.entries()) {
      if (isBaseApp) {
        baseAppAddresses.add(address);
        const token = tokens.find(t => t.tokenAddress.toLowerCase() === address);
        if (token) {
          console.log(`✓ ${token.symbol} (${address.slice(0, 10)}...) is a BaseApp token from wallet`);
        }
      }
    }
    
    return baseAppAddresses;
  }

  // Analyze a single token
  private async analyzeToken(
    token: TokenBalance,
    address: string,
    walletData: WalletData
  ): Promise<PostAnalytics | null> {
    try {
      // Skip zero balance tokens
      if (parseFloat(token.balanceFormatted) === 0) {
        return null;
      }

      console.log(`Analyzing token: ${token.symbol} (${token.tokenAddress})`);
      console.log(`  Balance: ${token.balanceFormatted} ${token.symbol}`);

      // Find all transactions related to this token (batch this call)
      const tokenTxs = await this.findTokenTransactions(address, token.tokenAddress, walletData.transactions);
      console.log(`  Found ${tokenTxs.length} token transactions`);

        // Find corresponding ETH transactions for token purchases
        // Match token transfers with ETH transactions by timestamp and block
        const postTransactions: BaseAppPostTransaction[] = [];
        const tokenDecimals = token.decimals || 18;
        const addressLower = address.toLowerCase();
        
        // Group transactions by block for better matching
        const transactionsByBlock = new Map<number, Transaction[]>();
        for (const tx of walletData.transactions) {
          if (!transactionsByBlock.has(tx.blockNumber)) {
            transactionsByBlock.set(tx.blockNumber, []);
          }
          transactionsByBlock.get(tx.blockNumber)!.push(tx);
        }
        
        for (const tokenTx of tokenTxs) {
          const isBuy = tokenTx.to?.toLowerCase() === addressLower;
          const isSell = tokenTx.from?.toLowerCase() === addressLower;
          
          if (isBuy) {
            // Find ETH transaction in the same block or nearby blocks
            let ethTx: Transaction | undefined;
            
            // First try same block
            const sameBlockTxs = transactionsByBlock.get(tokenTx.blockNumber) || [];
            ethTx = sameBlockTxs.find((tx) => {
              return tx.from?.toLowerCase() === addressLower && 
                     BigInt(tx.value || '0') > 0n &&
                     tx.hash !== tokenTx.hash;
            });
            
            // If not found, try nearby blocks (within 3 blocks)
            if (!ethTx) {
              for (let blockOffset = 1; blockOffset <= 3; blockOffset++) {
                const nearbyBlockTxs = transactionsByBlock.get(tokenTx.blockNumber + blockOffset) || [];
                ethTx = nearbyBlockTxs.find((tx) => {
                  const timeDiff = Math.abs(tx.timestamp - tokenTx.timestamp);
                  return tx.from?.toLowerCase() === addressLower && 
                         BigInt(tx.value || '0') > 0n &&
                         timeDiff <= 60; // Within 60 seconds
                });
                if (ethTx) break;
                
                const prevBlockTxs = transactionsByBlock.get(tokenTx.blockNumber - blockOffset) || [];
                ethTx = prevBlockTxs.find((tx) => {
                  const timeDiff = Math.abs(tx.timestamp - tokenTx.timestamp);
                  return tx.from?.toLowerCase() === addressLower && 
                         BigInt(tx.value || '0') > 0n &&
                         timeDiff <= 60;
                });
                if (ethTx) break;
              }
            }
            
            // tokenTx.value is token amount in smallest units
            // ethTx.value is ETH paid in wei
            postTransactions.push({
              ...tokenTx,
              isBaseAppPost: true,
              postTokenAddress: token.tokenAddress,
              type: 'buy',
              amount: tokenTx.tokenValue || tokenTx.value || '0', // Token amount
              price: ethTx?.value || '0', // ETH paid
            });
          } else if (isSell) {
            // For sells, try to find ETH received
            let ethTx: Transaction | undefined;
            const sameBlockTxs = transactionsByBlock.get(tokenTx.blockNumber) || [];
            ethTx = sameBlockTxs.find((tx) => {
              return tx.to?.toLowerCase() === addressLower && 
                     BigInt(tx.value || '0') > 0n &&
                     tx.hash !== tokenTx.hash;
            });
            
            postTransactions.push({
              ...tokenTx,
              isBaseAppPost: true,
              postTokenAddress: token.tokenAddress,
              type: 'sell',
              amount: tokenTx.tokenValue || tokenTx.value || '0', // Token amount sold
              price: ethTx?.value || '0', // ETH received
            });
          }
        }

        // If no transactions found but token has balance, try to find any ETH transaction
        // that might be related (user might have bought but transfer event not captured)
        if (postTransactions.length === 0 && parseFloat(token.balanceFormatted) > 0) {
          console.log(`No transactions found for token ${token.symbol}, but balance exists: ${token.balanceFormatted}`);
          
          // Look for any ETH transactions that might be purchases
          // This is a fallback - in production you'd decode transaction logs
          const possiblePurchaseTxs = walletData.transactions
            .filter(tx => BigInt(tx.value || '0') > 0n)
            .slice(0, 5); // Check last 5 ETH transactions
          
          for (const ethTx of possiblePurchaseTxs) {
            postTransactions.push({
              ...ethTx,
              isBaseAppPost: true,
              postTokenAddress: token.tokenAddress,
              type: 'buy',
              amount: token.balance, // Assume all balance was bought
              price: ethTx.value,
            });
          }
          
          // If still no transactions, create placeholder
          if (postTransactions.length === 0) {
            console.log(`Creating placeholder transaction for ${token.symbol}`);
            postTransactions.push({
              hash: 'mint',
              from: address,
              to: token.tokenAddress,
              value: '0',
              timestamp: Date.now() / 1000,
              blockNumber: 0,
              input: '',
              isBaseAppPost: true,
              postTokenAddress: token.tokenAddress,
              type: 'mint',
              amount: token.balance,
              price: '0',
            });
          }
        }

        if (postTransactions.length > 0) {
          // Get current price (with timeout to avoid hanging)
          let currentPrice: PriceData;
          try {
            currentPrice = await Promise.race([
              this.priceService.getPostPrice(undefined, token.tokenAddress),
              new Promise<PriceData>((_, reject) => 
                setTimeout(() => reject(new Error('Price fetch timeout')), 10000)
              )
            ]);
          } catch (error) {
            console.warn(`Price fetch failed for ${token.symbol}:`, error);
            currentPrice = { price: '0', source: 'none', timestamp: Date.now() };
          }

          // Check price value
          const priceValue = parseFloat(currentPrice.price || '0');
          console.log(`  Price for ${token.symbol}: ${currentPrice.price} (source: ${currentPrice.source}, value: ${priceValue})`);

          // Skip tokens with zero or invalid price
          if (!currentPrice.price || 
              isNaN(priceValue) || 
              priceValue <= 0 || 
              !isFinite(priceValue)) {
            console.log(`  Skipping ${token.symbol} - invalid or zero price: ${currentPrice.price}`);
            return null;
          }

          // Calculate PnL
          const analytics = await this.pnlCalculator.calculatePostAnalytics(
            postTransactions,
            token.balanceFormatted, // Use formatted balance
            currentPrice,
            token.decimals
          );

          // Add post name
          analytics.postName = token.name || token.symbol;

          console.log(`  ✓ ${token.symbol} analyzed: PnL ${analytics.pnlPct.toFixed(2)}%`);
          return analytics;
        }
      } catch (error) {
        console.error(`Error analyzing token ${token.tokenAddress}:`, error);
        return null;
      }
      
      return null;
    }

  private async findTokenTransactions(
    walletAddress: string,
    tokenAddress: string,
    allTransactions: Transaction[]
  ): Promise<Transaction[]> {
    // Use Etherscan API V2 to get ERC-20 Transfer events for this specific token
    try {
      const apiKey = this.walletService.baseScanApiKey || '';
      const ETHERSCAN_API_V2 = 'https://api.etherscan.io/v2/api';
      const BASE_CHAIN_ID = '8453'; // Base chain ID
      
      const response = await fetch(
        `${ETHERSCAN_API_V2}?chainid=${BASE_CHAIN_ID}&module=account&action=tokentx&contractaddress=${tokenAddress}&address=${walletAddress}&startblock=0&endblock=99999999&sort=desc${apiKey ? `&apikey=${apiKey}` : ''}`
      );
      
      const data = await response.json();
      
      console.log(`Token transactions API response for ${tokenAddress}:`, {
        status: data.status,
        resultCount: data.result?.length || 0,
        message: data.message
      });
      
      if (data.status === '1' && data.result && Array.isArray(data.result)) {
        // Convert token transfer events to Transaction format
        // In token transfer events, 'value' is the token amount, not ETH
        const tokenTxs: Transaction[] = data.result.map((tx: any) => ({
          hash: tx.hash,
          from: tx.from,
          to: tx.to,
          value: tx.value || '0', // This is token amount in wei/smallest unit
          timestamp: parseInt(tx.timeStamp),
          blockNumber: parseInt(tx.blockNumber),
          input: tx.input || '0x',
          methodId: '0xa9059cbb', // transfer method
          // Store additional token data
          tokenValue: tx.value, // Token amount
          tokenDecimals: parseInt(tx.tokenDecimal || '18'),
        }));
        
        return tokenTxs;
      }
    } catch (error) {
      console.error(`Error fetching token transactions for ${tokenAddress}:`, error);
    }

    // Fallback: search in all transactions
    const relevantTxs: Transaction[] = [];
    const walletLower = walletAddress.toLowerCase();
    const tokenLower = tokenAddress.toLowerCase();

    for (const tx of allTransactions) {
      // Check if transaction involves the token contract
      if (tx.to?.toLowerCase() === tokenLower || tx.from?.toLowerCase() === tokenLower) {
        relevantTxs.push(tx);
      }
      
      // Check if input data contains token address
      if (tx.input.toLowerCase().includes(tokenLower.slice(2))) {
        relevantTxs.push(tx);
      }
    }

    return relevantTxs;
  }
}

