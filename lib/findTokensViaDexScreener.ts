import { TokenBalance } from './wallet';
import { getDexScreenerPrice, getDexScreenerTokenPairs, getDexScreenerTokensBatch } from './getPostPrice';

/**
 * Find missing tokens by checking DexScreener for tokens that have pairs on Base
 * This is a fallback method to find tokens that might be missing from Etherscan API
 */
export async function findMissingTokensViaDexScreener(
  walletAddress: string,
  existingTokens: TokenBalance[]
): Promise<TokenBalance[]> {
  console.log('Searching for missing tokens via DexScreener...');
  
  // DexScreener doesn't have a direct API to get tokens by wallet address
  // But we can try to find tokens by checking known Base pairs
  // This is a limited approach, but can help find some missing tokens
  
  const foundTokens: TokenBalance[] = [];
  const existingAddresses = new Set(existingTokens.map(t => t.tokenAddress.toLowerCase()));
  
  // Note: DexScreener doesn't provide wallet-based token discovery
  // This function is a placeholder for future implementation
  // For now, we'll use it to verify existing tokens have prices on DexScreener
  
  console.log(`DexScreener token discovery: Found ${foundTokens.length} additional tokens`);
  
  return foundTokens;
}

/**
 * Verify and enrich token data using DexScreener
 * Uses batch API for efficiency (up to multiple tokens at once)
 */
export async function enrichTokensWithDexScreener(
  tokens: TokenBalance[]
): Promise<Map<string, { hasPrice: boolean; priceUsd?: string; liquidityUsd?: number }>> {
  const results = new Map<string, { hasPrice: boolean; priceUsd?: string; liquidityUsd?: number }>();
  
  if (tokens.length === 0) {
    return results;
  }
  
  console.log(`Enriching ${tokens.length} tokens with DexScreener data (using batch API)...`);
  
  // Use batch API for Base chain (chainId: 'base')
  const chainId = 'base';
  const tokenAddresses = tokens.map(t => t.tokenAddress);
  
  // Process in batches of 10 to avoid URL length limits
  const BATCH_SIZE = 10;
  for (let i = 0; i < tokenAddresses.length; i += BATCH_SIZE) {
    const batch = tokenAddresses.slice(i, i + BATCH_SIZE);
    
    try {
      // Try batch API first (more efficient)
      const batchData = await getDexScreenerTokensBatch(chainId, batch);
      
      for (const token of tokens.slice(i, i + BATCH_SIZE)) {
        const tokenData = batchData.get(token.tokenAddress.toLowerCase());
        if (tokenData) {
          // Token found in batch response
          results.set(token.tokenAddress.toLowerCase(), {
            hasPrice: true,
            priceUsd: tokenData.priceUsd || undefined,
            liquidityUsd: tokenData.liquidityUsd || undefined,
          });
        } else {
          // Not in batch, try individual price check
          const dexData = await getDexScreenerPrice(token.tokenAddress);
          if (dexData && dexData.priceUsd) {
            results.set(token.tokenAddress.toLowerCase(), {
              hasPrice: true,
              priceUsd: dexData.priceUsd,
              liquidityUsd: dexData.liquidityUsd,
            });
            console.log(`✓ ${token.symbol} has price on DexScreener: $${dexData.priceUsd}`);
          } else {
            results.set(token.tokenAddress.toLowerCase(), {
              hasPrice: false,
            });
          }
        }
      }
    } catch (error) {
      console.warn(`Batch enrichment failed, falling back to individual checks:`, error);
      
      // Fallback to individual checks
      for (const token of tokens.slice(i, i + BATCH_SIZE)) {
        try {
          const dexData = await getDexScreenerPrice(token.tokenAddress);
          if (dexData && dexData.priceUsd) {
            results.set(token.tokenAddress.toLowerCase(), {
              hasPrice: true,
              priceUsd: dexData.priceUsd,
              liquidityUsd: dexData.liquidityUsd,
            });
            console.log(`✓ ${token.symbol} has price on DexScreener: $${dexData.priceUsd}`);
          } else {
            results.set(token.tokenAddress.toLowerCase(), {
              hasPrice: false,
            });
          }
        } catch (err) {
          console.warn(`Failed to check DexScreener for ${token.symbol}:`, err);
          results.set(token.tokenAddress.toLowerCase(), {
            hasPrice: false,
          });
        }
        
        // Small delay to avoid rate limits (60 requests per minute)
        await new Promise(resolve => setTimeout(resolve, 1100)); // ~1 second between requests
      }
    }
    
    // Delay between batches
    if (i + BATCH_SIZE < tokenAddresses.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  const withPrice = Array.from(results.values()).filter(r => r.hasPrice).length;
  console.log(`DexScreener enrichment: ${withPrice}/${tokens.length} tokens have prices`);
  
  return results;
}

