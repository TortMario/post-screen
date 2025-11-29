import { ethers } from 'ethers';
import { getUniswapPriceFromPool } from './getUniswapPrice';

const BASEAPP_API = 'https://api.baseapp.xyz/v1';
const BASE_RPC_URL = 'https://mainnet.base.org';

export interface DexScreenerPrice {
  priceUsd: string;
  liquidityUsd: number;
  pairAddress: string;
  dexId: string;
}

/**
 * Get token price from DexScreener using latest/dex/tokens endpoint
 */
export async function getDexScreenerPrice(tokenAddress: string): Promise<DexScreenerPrice | null> {
  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`);
    
    if (!res.ok) {
      console.warn(`DexScreener API error: ${res.status} ${res.statusText}`);
      return null;
    }
    
    const data = await res.json();
    
    if (!data?.pairs?.length) {
      console.warn(`No pairs found for token ${tokenAddress.slice(0, 10)}...`);
      return null;
    }
    
    // Find the most liquid pair on Base
    const basePairs = data.pairs.filter(
      (p: any) => p.chainId === 'base' && p.liquidity?.usd && parseFloat(p.liquidity.usd) > 0
    );
    
    let pair;
    if (basePairs.length === 0) {
      // If no Base pairs, try any pair with price > 0
      const validPairs = data.pairs.filter((p: any) => 
        p.priceUsd && parseFloat(p.priceUsd) > 0
      );
      if (validPairs.length === 0) {
        console.warn(`No valid pairs with price > 0 for token ${tokenAddress.slice(0, 10)}...`);
        return null;
      }
      // Sort by liquidity
      validPairs.sort((a: any, b: any) => 
        (parseFloat(b.liquidity?.usd || '0')) - (parseFloat(a.liquidity?.usd || '0'))
      );
      pair = validPairs[0];
    } else {
      // Sort by liquidity and get the best pair
      basePairs.sort((a: any, b: any) => parseFloat(b.liquidity.usd) - parseFloat(a.liquidity.usd));
      pair = basePairs[0];
    }
    
    if (!pair.priceUsd || parseFloat(pair.priceUsd) === 0) {
      console.warn(`Pair has zero price for token ${tokenAddress.slice(0, 10)}...`);
      return null;
    }
    
    return {
      priceUsd: pair.priceUsd,
      liquidityUsd: pair.liquidity?.usd || 0,
      pairAddress: pair.pairAddress,
      dexId: pair.dexId
    };
  } catch (e) {
    console.error(`Error fetching DexScreener price for ${tokenAddress}:`, e);
    return null;
  }
}

/**
 * Get token pairs from DexScreener using token-pairs endpoint (more efficient for multiple tokens)
 */
export async function getDexScreenerTokenPairs(chainId: string, tokenAddress: string): Promise<any[] | null> {
  try {
    const res = await fetch(`https://api.dexscreener.com/token-pairs/v1/${chainId}/${tokenAddress}`);
    
    if (!res.ok) {
      console.warn(`DexScreener token-pairs API error: ${res.status} ${res.statusText}`);
      return null;
    }
    
    const data = await res.json();
    return data?.pairs || null;
  } catch (e) {
    console.error(`Error fetching DexScreener token pairs for ${tokenAddress}:`, e);
    return null;
  }
}

/**
 * Get multiple tokens info at once using tokens endpoint (batch request)
 */
export async function getDexScreenerTokensBatch(chainId: string, tokenAddresses: string[]): Promise<Map<string, any>> {
  const results = new Map<string, any>();
  
  if (tokenAddresses.length === 0) {
    return results;
  }
  
  try {
    // DexScreener tokens endpoint accepts comma-separated addresses
    const addressesParam = tokenAddresses.join(',');
    const res = await fetch(`https://api.dexscreener.com/tokens/v1/${chainId}/${addressesParam}`);
    
    if (!res.ok) {
      console.warn(`DexScreener tokens batch API error: ${res.status} ${res.statusText}`);
      return results;
    }
    
    const data = await res.json();
    
    if (data?.tokens && Array.isArray(data.tokens)) {
      for (const token of data.tokens) {
        if (token?.address) {
          results.set(token.address.toLowerCase(), token);
        }
      }
    }
    
    console.log(`DexScreener batch: Found info for ${results.size}/${tokenAddresses.length} tokens`);
  } catch (e) {
    console.error(`Error fetching DexScreener tokens batch:`, e);
  }
  
  return results;
}

export interface PriceData {
  price: string;
  source: 'baseapp' | 'dexscreener' | 'onchain' | 'none';
  timestamp: number;
  isUSD?: boolean; // true if price is in USD (from DexScreener), false if in ETH
}

// Get ETH/USD price from CoinGecko
async function getETHPrice(coinGeckoApiKey?: string): Promise<number> {
  // Try CoinGecko first (with API key if provided)
  try {
    const apiKeyParam = coinGeckoApiKey ? `&x_cg_demo_api_key=${coinGeckoApiKey}` : '';
    const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd${apiKeyParam}`);
    const data = await res.json();
    const price = data?.ethereum?.usd;
    if (price && parseFloat(price) > 0) {
      return parseFloat(price);
    }
  } catch (e) {
    console.warn('CoinGecko API failed:', e);
  }
  
  // Fallback: try CoinMarketCap if API key provided
  // (CoinMarketCap code removed for simplicity, using CoinGecko as primary)
  
  return 3000; // Final fallback
}

// Get token price from CoinGecko by contract address on Base
export async function getCoinGeckoTokenPrice(tokenAddress: string, coinGeckoApiKey?: string): Promise<string | null> {
  try {
    const apiKeyParam = coinGeckoApiKey ? `&x_cg_demo_api_key=${coinGeckoApiKey}` : '';
    // CoinGecko uses platform ID 'base' for Base network
    const res = await fetch(`https://api.coingecko.com/api/v3/simple/token_price/base?contract_addresses=${tokenAddress}&vs_currencies=usd${apiKeyParam}`);
    const data = await res.json();
    
    const tokenData = data[tokenAddress.toLowerCase()];
    if (tokenData?.usd && parseFloat(tokenData.usd) > 0) {
      return tokenData.usd.toString();
    }
    return null;
  } catch (e) {
    console.warn(`CoinGecko token price failed for ${tokenAddress}:`, e);
    return null;
  }
}

export class PostPriceService {
  private provider: ethers.JsonRpcProvider;
  private coinGeckoApiKey?: string;

  constructor(coinGeckoApiKey?: string) {
    this.provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
    this.coinGeckoApiKey = coinGeckoApiKey;
  }

  async getPostPrice(postId?: string, tokenAddress?: string): Promise<PriceData> {
    // Try Uniswap pool first (most accurate - reads directly from blockchain)
    if (tokenAddress) {
      try {
        console.log(`  Attempting to get Uniswap pool price for ${tokenAddress.slice(0, 10)}...`);
        const uniswapPrice = await getUniswapPriceFromPool(tokenAddress);
        if (uniswapPrice && uniswapPrice.priceInUSD > 0) {
          console.log(`  ✓ Uniswap pool price for ${tokenAddress.slice(0, 10)}...: $${uniswapPrice.priceInUSD.toFixed(6)} USD`);
          return {
            price: uniswapPrice.priceInUSD.toString(),
            source: 'onchain',
            timestamp: Date.now(),
            isUSD: true,
          };
        } else {
          console.warn(`  ✗ Uniswap pool price not available for ${tokenAddress.slice(0, 10)}...`);
        }
      } catch (error) {
        console.warn(`  ✗ Uniswap pool price failed for ${tokenAddress}:`, error);
      }
      
      // Try DexScreener as second option
      try {
        console.log(`  Attempting to get DexScreener price for ${tokenAddress.slice(0, 10)}...`);
        const dexData = await getDexScreenerPrice(tokenAddress);
        if (dexData && dexData.priceUsd) {
          const priceValue = parseFloat(dexData.priceUsd);
          if (!isNaN(priceValue) && priceValue > 0 && isFinite(priceValue)) {
            console.log(`  ✓ DexScreener price for ${tokenAddress.slice(0, 10)}...: $${dexData.priceUsd} USD`);
            return {
              price: dexData.priceUsd,
              source: 'dexscreener',
              timestamp: Date.now(),
              isUSD: true, // Price is in USD
            };
          } else {
            console.warn(`  ✗ DexScreener price invalid for ${tokenAddress.slice(0, 10)}...: ${dexData.priceUsd}`);
          }
        } else {
          console.warn(`  ✗ DexScreener price not available for ${tokenAddress.slice(0, 10)}...`);
        }
      } catch (error) {
        console.warn(`  ✗ DexScreener API failed for ${tokenAddress}:`, error);
      }
      
      // Try CoinGecko as third option
      try {
        const cgPrice = await getCoinGeckoTokenPrice(tokenAddress, this.coinGeckoApiKey);
        if (cgPrice) {
          const priceValue = parseFloat(cgPrice);
          if (!isNaN(priceValue) && priceValue > 0 && isFinite(priceValue)) {
            console.log(`  CoinGecko price for ${tokenAddress.slice(0, 10)}...: $${cgPrice} USD`);
            return {
              price: cgPrice,
              source: 'dexscreener', // Using same source type
              timestamp: Date.now(),
              isUSD: true,
            };
          }
        }
      } catch (error) {
        console.warn(`  CoinGecko API failed for ${tokenAddress}:`, error);
      }
    }

    // Try BaseApp API as fallback
    if (postId) {
      try {
        const price = await this.getPriceFromBaseAppAPI(postId);
        if (price) {
          const priceValue = parseFloat(price);
          if (!isNaN(priceValue) && priceValue > 0 && isFinite(priceValue)) {
            console.log(`  BaseApp API price: ${price} (assuming USD)`);
            return {
              price,
              source: 'baseapp',
              timestamp: Date.now(),
              isUSD: true, // BaseApp API likely returns USD
            };
          }
        }
      } catch (error) {
        console.warn('  BaseApp API failed:', error);
      }
    }

    // Try on-chain bonding curve as last resort (returns ETH price)
    if (tokenAddress) {
      try {
        const price = await this.getPriceOnChain(tokenAddress);
        if (price) {
          const priceValue = parseFloat(price);
          if (!isNaN(priceValue) && priceValue > 0 && isFinite(priceValue)) {
            // Convert ETH to USD
            const ethPrice = await getETHPrice(this.coinGeckoApiKey);
            const priceUSD = priceValue * ethPrice;
            console.log(`  On-chain price: ${price} ETH = $${priceUSD.toFixed(6)} USD`);
            return {
              price: priceUSD.toString(),
              source: 'onchain',
              timestamp: Date.now(),
              isUSD: true, // Converted to USD
            };
          }
        }
      } catch (error) {
        console.warn('  On-chain price fetch failed:', error);
      }
    }

    // Return zero price if nothing found (will be filtered out later)
    console.warn(`  No price found for ${tokenAddress || postId || 'unknown'}`);
    return {
      price: '0',
      source: 'none',
      timestamp: Date.now(),
    };
  }

  private async getPriceFromBaseAppAPI(postId: string): Promise<string | null> {
    try {
      const response = await fetch(`${BASEAPP_API}/post/${postId}`);
      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return data.price?.toString() || null;
    } catch (error) {
      return null;
    }
  }


  private async getPriceOnChain(tokenAddress: string): Promise<string | null> {
    try {
      // Standard bonding curve interface
      // This is a simplified version - actual implementation would need the contract ABI
      const curveABI = [
        'function getBuyPrice(uint256 amount) public view returns (uint256)',
        'function getSellPrice(uint256 amount) public view returns (uint256)',
        'function price() public view returns (uint256)',
      ];

      const contract = new ethers.Contract(tokenAddress, curveABI, this.provider);

      // Try different methods
      try {
        const price = await contract.price();
        return ethers.formatEther(price);
      } catch {
        // Try getBuyPrice(1)
        try {
          const price = await contract.getBuyPrice(1);
          return ethers.formatEther(price);
        } catch {
          // Try getSellPrice(1)
          try {
            const price = await contract.getSellPrice(1);
            return ethers.formatEther(price);
          } catch {
            return null;
          }
        }
      }
    } catch (error) {
      return null;
    }
  }
}

