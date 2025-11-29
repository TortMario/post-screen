import { ethers } from 'ethers';

// Base RPC endpoints (fallback chain for rate limits)
const BASE_RPC_URLS = [
  'https://mainnet.base.org',
  'https://base-mainnet.g.alchemy.com/v2/demo', // Alchemy public endpoint
  'https://base.publicnode.com', // Public node
];

const BASE_RPC_URL = BASE_RPC_URLS[0]; // Primary endpoint
const ETHERSCAN_API_V2 = 'https://api.etherscan.io/v2/api';
const BASE_CHAIN_ID = '8453'; // Base chain ID for Etherscan API V2

// Helper to get RPC with retry
function getRpcProvider(): ethers.JsonRpcProvider {
  return new ethers.JsonRpcProvider(BASE_RPC_URL, {
    name: 'base',
    chainId: 8453,
  });
}

export interface WalletData {
  address: string;
  balance: string;
  tokens: TokenBalance[];
  transactions: Transaction[];
}

export interface TokenBalance {
  contractAddress: string;
  tokenAddress: string;
  name: string;
  symbol: string;
  decimals: number;
  balance: string;
  balanceFormatted: string;
}

export interface Transaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  timestamp: number;
  blockNumber: number;
  input: string;
  methodId?: string;
  isBaseAppPost?: boolean;
  postTokenAddress?: string;
  postId?: string;
  type?: 'buy' | 'sell' | 'mint';
  tokenValue?: string; // Token amount for ERC-20 transfers
  tokenDecimals?: number; // Token decimals
}

export class WalletService {
  private provider: ethers.JsonRpcProvider;
  public baseScanApiKey: string;

  constructor(baseScanApiKey?: string) {
    this.provider = getRpcProvider();
    this.baseScanApiKey = baseScanApiKey || '';
  }

  async connectWallet(): Promise<string> {
    if (typeof window === 'undefined' || !window.ethereum) {
      throw new Error('MetaMask or compatible wallet not found');
    }

    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const address = await signer.getAddress();
    return address;
  }

  async getWalletData(address: string): Promise<WalletData> {
    console.log('Getting wallet data for:', address);
    
    try {
      const [balance, tokens, transactions] = await Promise.all([
        this.getBalance(address).catch(err => {
          console.error('Error getting balance:', err);
          return 0n;
        }),
        this.getTokenBalances(address).catch(err => {
          console.error('Error getting tokens:', err);
          return [];
        }),
        this.getTransactions(address).catch(err => {
          console.error('Error getting transactions:', err);
          return [];
        }),
      ]);

      console.log('Wallet data retrieved:', {
        balance: ethers.formatEther(balance),
        tokenCount: tokens.length,
        txCount: transactions.length
      });

      return {
        address,
        balance: ethers.formatEther(balance),
        tokens,
        transactions,
      };
    } catch (error: any) {
      console.error('Error in getWalletData:', error);
      throw error;
    }
  }

  async getBalance(address: string): Promise<bigint> {
    return await this.provider.getBalance(address);
  }

  async getTokenBalances(address: string): Promise<TokenBalance[]> {
    // Use Etherscan API V2 to get token balances
    // Note: tokenlist endpoint requires paid API plan for Base chain
    // Use tokentx endpoint (works with free API) to calculate balances from transactions
    try {
      if (!this.baseScanApiKey) {
        console.warn('⚠️ No API key provided. Please add NEXT_PUBLIC_BASESCAN_API_KEY to .env.local');
        console.warn('⚠️ Without API key, you will hit rate limits quickly (5 calls/second)');
      } else {
        console.log('✓ API key provided (length:', this.baseScanApiKey.length, ', first 10 chars:', this.baseScanApiKey.slice(0, 10) + '...)');
      }
      
      // Use tokentx endpoint (works with free API plan)
      // Try to fetch as many transactions as possible (up to 10,000 per request)
      const url = `${ETHERSCAN_API_V2}?chainid=${BASE_CHAIN_ID}&module=account&action=tokentx&address=${address}&startblock=0&endblock=99999999&sort=desc&page=1&offset=10000${this.baseScanApiKey ? `&apikey=${this.baseScanApiKey}` : ''}`;
      console.log('Fetching token balances from Etherscan API V2 (tokentx):', url.replace(this.baseScanApiKey || '', '***'));
      console.log('API key in URL:', this.baseScanApiKey ? 'Yes' : 'No');
      
      const response = await fetch(url);
      
      if (!response.ok) {
        console.error('Etherscan API V2 error:', response.status, response.statusText);
        throw new Error(`Etherscan API V2 error: ${response.status} ${response.statusText}`);
      }
      
      const responseText = await response.text();
      console.log('=== Etherscan API V2 Raw Response ===');
      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));
      console.log('Response text (first 1000 chars):', responseText.slice(0, 1000));
      
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse JSON response:', parseError);
        console.error('Full response text:', responseText);
        throw new Error(`Invalid JSON response from API: ${responseText.slice(0, 200)}`);
      }
      
      console.log('=== Etherscan API V2 Parsed Response ===');
      console.log('Full response:', JSON.stringify(data, null, 2));
      console.log('Status:', data.status);
      console.log('Message:', data.message);
      console.log('Result type:', typeof data.result);
      console.log('Result length:', Array.isArray(data.result) ? data.result.length : 'N/A');
      console.log('API Key provided:', !!this.baseScanApiKey);
      console.log('API Key length:', this.baseScanApiKey?.length || 0);
      console.log('API Key (first 10 chars):', this.baseScanApiKey ? this.baseScanApiKey.slice(0, 10) + '...' : 'N/A');
      
      // Check for V1 deprecation message
      if (data.message?.includes('deprecated V1 endpoint')) {
        console.error('Still using V1 endpoint! This should not happen with V2.');
      }
      
      // Handle different response statuses
      if (data.status !== '1') {
        console.error('❌ Etherscan API V2 returned error:');
        console.error('  Status:', data.status);
        console.error('  Message:', data.message);
        console.error('  Result:', typeof data.result === 'string' ? data.result : JSON.stringify(data.result, null, 2).slice(0, 500));
        console.error('  Full error response:', JSON.stringify(data, null, 2));
        
        // Check for specific error messages
        const errorMsg = (data.message || '').toLowerCase();
        const resultMsg = (typeof data.result === 'string' ? data.result : '').toLowerCase();
        const fullErrorText = errorMsg + ' ' + resultMsg;
        
        console.error('  Error analysis:');
        console.error('    - Contains "rate limit":', fullErrorText.includes('rate limit'));
        console.error('    - Contains "invalid api key":', fullErrorText.includes('invalid api key'));
        console.error('    - Contains "api key":', fullErrorText.includes('api key'));
        console.error('    - Contains "notok":', fullErrorText.includes('notok'));
        console.error('    - API key present:', !!this.baseScanApiKey);
        
        if (fullErrorText.includes('rate limit') || fullErrorText.includes('max rate limit')) {
          console.error('⚠️ Rate limit exceeded. Please wait a few minutes or upgrade your API plan.');
        }
        
        if (fullErrorText.includes('invalid api key') || 
            (fullErrorText.includes('api key') && !fullErrorText.includes('rate limit'))) {
          console.error('⚠️ API key issue. Check if your Etherscan API key is valid.');
          console.error('   API key format check:', this.baseScanApiKey ? `Length: ${this.baseScanApiKey.length}, Starts with: ${this.baseScanApiKey.slice(0, 5)}...` : 'No API key');
        }
        
        // Always try alternative method if API returns error
        console.warn('Trying alternative method: direct RPC token balance check...');
        try {
          const rpcResult = await this.getTokenBalancesViaRPC(address);
          if (rpcResult.length > 0) {
            console.log(`✓ RPC method found ${rpcResult.length} tokens - API may have issues`);
            return rpcResult;
          }
        } catch (rpcError) {
          console.error('RPC fallback also failed:', rpcError);
        }
        
        // If result is a string error message, log it
        if (typeof data.result === 'string') {
          console.error('API error message:', data.result);
        }
        
        return [];
      }
      
      if (!data.result) {
        console.warn('No result field in API response');
        console.warn('Full response:', JSON.stringify(data, null, 2).slice(0, 500));
        return [];
      }
      
      if (!Array.isArray(data.result)) {
        console.warn('Result is not an array:', typeof data.result, data.result);
        // Try alternative method
        return await this.getTokenBalancesViaRPC(address);
      }
      
      if (data.result.length === 0) {
        console.warn('⚠️ API returned empty array - no token transactions found');
        console.warn('This might mean:');
        console.warn('1. Wallet has no token transactions on Base network');
        console.warn('2. API key has limited access (free tier may have restrictions)');
        console.warn('3. Address has no ERC-20 token activity');
        console.warn('4. All transactions are outside the queried block range');
        console.warn(`Checked address: ${address}`);
        console.warn(`API endpoint: ${ETHERSCAN_API_V2}`);
        console.warn(`Chain ID: ${BASE_CHAIN_ID}`);
        console.warn(`API key present: ${!!this.baseScanApiKey}`);
        console.warn(`API key length: ${this.baseScanApiKey?.length || 0}`);
        console.warn(`API response status: ${data.status}`);
        console.warn(`API response message: ${data.message}`);
        
        // Try alternative method as fallback
        console.warn('Trying alternative RPC method to verify...');
        try {
          const rpcResult = await this.getTokenBalancesViaRPC(address);
          if (rpcResult.length > 0) {
            console.log(`✓ RPC method found ${rpcResult.length} tokens - API may have issues`);
            return rpcResult;
          } else {
            console.warn('⚠️ RPC method also returned 0 tokens - wallet may truly have no tokens');
          }
        } catch (rpcError) {
          console.error('RPC fallback failed:', rpcError);
        }
        
        return [];
      }

      const tokenMap = new Map<string, TokenBalance>();

      console.log(`\n=== PROCESSING TRANSACTIONS ===`);
      console.log(`Total transactions to process: ${data.result.length}`);
      
      // Sample first transaction to see structure
      if (data.result.length > 0) {
        console.log('\nSample transaction structure:');
        console.log(JSON.stringify(data.result[0], null, 2).slice(0, 500));
        console.log('\nSample transaction fields:', Object.keys(data.result[0]));
      }

      let processedCount = 0;
      let skippedCount = 0;
      const addressLower = address.toLowerCase();

      for (const tx of data.result) {
        processedCount++;
        // Handle different field names in API response
        const contractAddress = tx.contractAddress || tx.tokenAddress || tx.to;
        if (!contractAddress) {
          console.warn('Transaction missing contractAddress/tokenAddress:', Object.keys(tx));
          continue;
        }

        const tokenAddress = contractAddress.toLowerCase();
        const txFrom = (tx.from || '').toLowerCase();
        const txTo = (tx.to || '').toLowerCase();
        const isFrom = txFrom === addressLower;
        const isTo = txTo === addressLower;

        // IMPORTANT: Only process transactions where the address is directly involved
        // API should already filter this, but double-check to ensure we only process relevant transactions
        if (!isFrom && !isTo) {
          // This shouldn't happen if API is working correctly, but skip just in case
          skippedCount++;
          if (skippedCount <= 3) { // Only log first few skipped
            console.warn(`Skipping transaction ${processedCount}/${data.result.length} - address not involved:`, {
              txHash: tx.hash?.slice(0, 12) + '...',
              from: txFrom.slice(0, 12) + '...',
              to: txTo.slice(0, 12) + '...',
              address: addressLower.slice(0, 12) + '...'
            });
          }
          continue;
        }

        if (!tokenMap.has(tokenAddress)) {
          tokenMap.set(tokenAddress, {
            contractAddress: tokenAddress,
            tokenAddress: tokenAddress,
            name: tx.tokenName || tx.name || 'Unknown',
            symbol: tx.tokenSymbol || tx.symbol || 'UNK',
            decimals: parseInt(tx.tokenDecimal || tx.decimals || '18'),
            balance: '0',
            balanceFormatted: '0',
          });
        }

        const token = tokenMap.get(tokenAddress)!;
        const value = BigInt(tx.value || '0');

        // Calculate balance: add if receiving, subtract if sending
        if (isTo) {
          // Address received tokens
          const oldBalance = token.balance;
          token.balance = (BigInt(token.balance) + value).toString();
          if (processedCount <= 5) { // Log first few transactions
            console.log(`  ✓ Received ${token.symbol}: +${value.toString()} (balance: ${oldBalance} → ${token.balance})`);
          }
        } else if (isFrom) {
          // Address sent tokens
          const currentBalance = BigInt(token.balance);
          const oldBalance = token.balance;
          if (currentBalance >= value) {
            token.balance = (currentBalance - value).toString();
            if (processedCount <= 5) { // Log first few transactions
              console.log(`  ✓ Sent ${token.symbol}: -${value.toString()} (balance: ${oldBalance} → ${token.balance})`);
            }
          } else {
            // Shouldn't happen, but handle edge case (balance went negative somehow)
            console.warn(`⚠️ Token balance went negative for ${token.symbol} (${tokenAddress.slice(0, 10)}...), resetting to 0. Balance was: ${oldBalance}, tried to subtract: ${value.toString()}`);
            token.balance = '0';
          }
        }
      }
      
      console.log(`\n=== TRANSACTION PROCESSING COMPLETE ===`);
      console.log(`Processed: ${processedCount} transactions`);
      console.log(`Skipped (not involved): ${skippedCount} transactions`);
      console.log(`Unique tokens found: ${tokenMap.size}`);
      console.log(`==========================================\n`);

      // Format balances and filter out tokens with zero balance
      // Only return tokens that currently belong to the address (balance > 0)
      const tokens = Array.from(tokenMap.values())
        .map((token) => {
          const balanceBigInt = BigInt(token.balance);
          const decimals = BigInt(10 ** token.decimals);
          const formatted = Number(balanceBigInt) / Number(decimals);
          return {
            ...token,
            balanceFormatted: formatted.toFixed(6),
          };
        })
        .filter((token) => {
          // Only return tokens with balance > 0 (tokens that belong to the address)
          const balance = parseFloat(token.balanceFormatted);
          return balance > 0;
        });

      console.log(`✓ Found ${tokens.length} tokens with balance > 0 (belonging to address)`);
      console.log(`✓ Total unique tokens in transaction history: ${tokenMap.size}`);
      console.log(`✓ Total token transactions processed: ${data.result.length}`);
      
      if (tokens.length > 0) {
        console.log('✓ Token details (with balance > 0):', tokens.slice(0, 20).map(t => ({
          symbol: t.symbol,
          name: t.name,
          balance: t.balanceFormatted,
          address: t.tokenAddress.slice(0, 10) + '...'
        })));
        if (tokens.length > 20) {
          console.log(`... and ${tokens.length - 20} more tokens`);
        }
      } else {
        console.warn('⚠️ No tokens with balance > 0 found!');
        console.warn('This means the address has no token holdings (all tokens were sold or transferred)');
        if (tokenMap.size > 0) {
          console.warn(`Note: Found ${tokenMap.size} tokens in transaction history, but all have zero balance`);
          // Log some examples of zero balance tokens for debugging
          const zeroBalanceTokens = Array.from(tokenMap.values()).filter(t => parseFloat(t.balance) === 0).slice(0, 5);
          if (zeroBalanceTokens.length > 0) {
            console.log('Zero balance token examples:', zeroBalanceTokens.map(t => ({
              symbol: t.symbol,
              address: t.tokenAddress.slice(0, 10) + '...'
            })));
          }
        }
      }
      
      // Return only tokens that belong to the address (balance > 0)
      console.log('\n=== TOKEN BALANCE SUMMARY ===');
      console.log(`Address: ${address}`);
      console.log(`Total transactions returned by API: ${data.result.length}`);
      console.log(`Unique tokens in transaction history: ${tokenMap.size}`);
      console.log(`Tokens with balance > 0 (current holdings): ${tokens.length}`);
      
      if (data.result.length >= 10000) {
        console.warn('⚠️ WARNING: API returned maximum results (10,000 transactions).');
        console.warn('⚠️ There may be more transactions. Current balance calculation may be incomplete.');
      }
      
      if (tokenMap.size > 0 && tokens.length === 0) {
        console.warn('⚠️ Found tokens in transaction history, but all have zero balance.');
        console.warn('⚠️ This means the address previously held tokens but no longer does.');
      }
      
      if (tokens.length > 0) {
        console.log('\n✅ Current token holdings:');
        tokens.slice(0, 20).forEach((t, i) => {
          console.log(`  ${i + 1}. ${t.symbol} (${t.name}): ${t.balanceFormatted} tokens`);
          console.log(`     Address: ${t.tokenAddress}`);
        });
        if (tokens.length > 20) {
          console.log(`  ... and ${tokens.length - 20} more tokens`);
        }
      } else {
        console.error('❌ No tokens with balance > 0 found!');
        console.error('Possible reasons:');
        console.error('  1. Address truly has no token holdings');
        console.error('  2. API returned incomplete transaction history');
        console.error('  3. Balance calculation from transactions failed');
      }
      console.log('=============================\n');
      
      return tokens;
    } catch (error: any) {
      console.error('❌ Error fetching token balances:', error);
      console.error('Error details:', error.message, error.stack);
      // Try alternative method on error
      console.warn('Trying alternative RPC method...');
      return await this.getTokenBalancesViaRPC(address).catch((rpcError) => {
        console.error('RPC method also failed:', rpcError);
        return [];
      });
    }
  }

  // Alternative method: Get token balances via RPC by checking known token contracts
  // This is a fallback when API doesn't work
  private async getTokenBalancesViaRPC(address: string): Promise<TokenBalance[]> {
    console.log('Using RPC method to get token balances...');
    
    // ERC-20 balanceOf ABI
    const erc20Abi = [
      'function balanceOf(address owner) view returns (uint256)',
      'function decimals() view returns (uint8)',
      'function symbol() view returns (string)',
      'function name() view returns (string)',
    ];

    // First, try to get token list from a token registry or use Etherscan API V2 with different endpoint
    try {
      // Try to get token list from Etherscan API V2 tokenlist endpoint
      const tokenListUrl = `${ETHERSCAN_API_V2}?chainid=${BASE_CHAIN_ID}&module=account&action=tokenlist&address=${address}${this.baseScanApiKey ? `&apikey=${this.baseScanApiKey}` : ''}`;
      console.log('Trying tokenlist endpoint (Etherscan API V2)...');
      
      const response = await fetch(tokenListUrl);
      const responseText = await response.text();
      console.log('Tokenlist endpoint response status:', response.status);
      console.log('Tokenlist endpoint response (first 500 chars):', responseText.slice(0, 500));
      
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse tokenlist JSON:', parseError);
        throw new Error(`Invalid JSON from tokenlist endpoint: ${responseText.slice(0, 200)}`);
      }
      
      console.log('Tokenlist endpoint parsed data:', JSON.stringify(data, null, 2).slice(0, 1000));
      
      if (data.status === '1' && Array.isArray(data.result)) {
        console.log(`✓ Found ${data.result.length} tokens via tokenlist endpoint`);
        const tokens = data.result.map((token: any) => ({
          contractAddress: token.contractAddress,
          tokenAddress: token.contractAddress,
          name: token.name || 'Unknown',
          symbol: token.symbol || 'UNK',
          decimals: parseInt(token.decimals || '18'),
          balance: token.balance || '0',
          balanceFormatted: (parseFloat(token.balance || '0') / Math.pow(10, parseInt(token.decimals || '18'))).toFixed(6),
        })).filter((t: TokenBalance) => parseFloat(t.balanceFormatted) > 0);
        
        console.log(`✓ Filtered to ${tokens.length} tokens with balance > 0`);
        return tokens;
      }
    } catch (error) {
      console.error('Tokenlist endpoint failed:', error);
    }

    // If that doesn't work, we need the user to provide token addresses or use a different approach
    console.warn('RPC method requires known token addresses. Please check BaseScan manually.');
    return [];
  }

  async getTransactions(address: string, limit: number = 1000): Promise<Transaction[]> {
    try {
      const url = `${ETHERSCAN_API_V2}?chainid=${BASE_CHAIN_ID}&module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&sort=desc${this.baseScanApiKey ? `&apikey=${this.baseScanApiKey}` : ''}`;
      console.log('Fetching transactions from Etherscan API V2:', url.replace(this.baseScanApiKey || '', '***'));
      
      const response = await fetch(url);
      
      if (!response.ok) {
        console.error('Etherscan API V2 error:', response.status, response.statusText);
        throw new Error(`Etherscan API V2 error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Transactions API response status:', data.status);
      console.log('Transactions count:', data.result?.length || 0);

      if (data.status !== '1') {
        console.error('Etherscan API V2 returned error:', data.message || data.result);
        return [];
      }
      
      if (!data.result || !Array.isArray(data.result)) {
        console.warn('No transactions found or invalid format');
        return [];
      }

      const transactions: Transaction[] = data.result.slice(0, limit).map((tx: any) => {
        const methodId = tx.input.length >= 10 ? tx.input.slice(0, 10) : undefined;

        return {
          hash: tx.hash,
          from: tx.from,
          to: tx.to,
          value: tx.value,
          timestamp: parseInt(tx.timeStamp),
          blockNumber: parseInt(tx.blockNumber),
          input: tx.input,
          methodId,
        };
      });

      console.log(`Returning ${transactions.length} transactions`);
      return transactions;
    } catch (error: any) {
      console.error('Error fetching transactions:', error);
      console.error('Error details:', error.message, error.stack);
      return [];
    }
  }
}


