import { ethers } from 'ethers';
import { isBaseAppTokenByReferrer, BASE_PLATFORM_REFERRER } from './getUniswapPrice';

// BaseApp token fingerprint - EIP-1167 Minimal Proxy clone
// All BaseApp tokens have identical runtime bytecode
const BASEAPP_FINGERPRINT = '0x363d3d373d3d3d363d737cad62748ddf516cf85bc2c05c14786d84cf861c5af43d82803e903d91602b57fd5bf3';
const BASEAPP_FINGERPRINT_LOWER = BASEAPP_FINGERPRINT.toLowerCase();

// Alternative: just proxy + implementation (shorter check)
const BASEAPP_PREFIX = '0x363d3d373d3d3d363d737cad62748ddf516cf85bc2c05c14786d84cf861c';
const BASEAPP_PREFIX_LOWER = BASEAPP_PREFIX.toLowerCase();

// Minimal proxy signature
const MINIMAL_PROXY_SIG = '363d3d373d3d3d363d73';

export class BaseAppDetector {
  private provider: ethers.JsonRpcProvider;
  private codeCache: Map<string, boolean> = new Map();

  constructor(provider?: ethers.JsonRpcProvider) {
    this.provider = provider || new ethers.JsonRpcProvider('https://mainnet.base.org');
  }

  /**
   * Check if a token address is a BaseApp token by comparing its bytecode
   * Also checks platformReferrer for additional verification
   * @param address Token contract address
   * @returns true if the token is a BaseApp token
   */
  async isBaseAppToken(address: string): Promise<boolean> {
    // Check cache first
    const cacheKey = address.toLowerCase();
    if (this.codeCache.has(cacheKey)) {
      return this.codeCache.get(cacheKey)!;
    }

    try {
      const code = await this.provider.getCode(address);
      
      if (!code || code === '0x' || code.length < 20) {
        this.codeCache.set(cacheKey, false);
        return false;
      }

      const codeLower = code.toLowerCase();
      
      // Check full fingerprint (most accurate)
      const hasBaseAppBytecode = codeLower === BASEAPP_FINGERPRINT_LOWER ||
                                 codeLower.startsWith(BASEAPP_PREFIX_LOWER);
      
      if (!hasBaseAppBytecode) {
        this.codeCache.set(cacheKey, false);
        return false;
      }
      
      // Additional verification: check platformReferrer if available
      // This helps distinguish Base App tokens from other Zora tokens
      try {
        const isBaseAppByReferrer = await isBaseAppTokenByReferrer(address, this.provider);
        // If bytecode matches, it's a BaseApp token (bytecode is the primary indicator)
        // platformReferrer is additional confirmation
        const isBaseApp = hasBaseAppBytecode;
        if (hasBaseAppBytecode && isBaseAppByReferrer) {
          console.log(`✓ Token ${address.slice(0, 10)}... confirmed as BaseApp by both bytecode and platformReferrer`);
        } else if (hasBaseAppBytecode) {
          console.log(`✓ Token ${address.slice(0, 10)}... confirmed as BaseApp by bytecode (platformReferrer check failed or not available)`);
        }
        this.codeCache.set(cacheKey, isBaseApp);
        return isBaseApp;
      } catch (error) {
        // If referrer check fails, still trust bytecode match (bytecode is the primary indicator)
        console.log(`✓ Token ${address.slice(0, 10)}... confirmed as BaseApp by bytecode (platformReferrer check error: ${error})`);
        this.codeCache.set(cacheKey, hasBaseAppBytecode);
        return hasBaseAppBytecode;
      }
    } catch (error) {
      console.error(`Error checking bytecode for ${address}:`, error);
      this.codeCache.set(cacheKey, false);
      return false;
    }
  }

  /**
   * Batch check multiple addresses (from wallet only, not scanning network)
   * @param addresses Array of token addresses from wallet
   * @returns Map of address -> isBaseApp
   */
  async checkMultipleTokens(addresses: string[]): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();
    
    if (addresses.length === 0) {
      return results;
    }
    
    console.log(`Checking bytecode for ${addresses.length} wallet tokens...`);
    
    // Process in batches to avoid rate limits
    const BATCH_SIZE = 5; // Smaller batches for wallet tokens
    for (let i = 0; i < addresses.length; i += BATCH_SIZE) {
      const batch = addresses.slice(i, i + BATCH_SIZE);
      console.log(`  Checking batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(addresses.length / BATCH_SIZE)} (${batch.length} tokens)...`);
      
      const promises = batch.map(addr => 
        this.isBaseAppToken(addr).then(isBaseApp => ({ addr, isBaseApp }))
      );
      
      const batchResults = await Promise.allSettled(promises);
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.set(result.value.addr.toLowerCase(), result.value.isBaseApp);
        }
      }
      
      // Small delay between batches to avoid rate limits
      if (i + BATCH_SIZE < addresses.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    
    return results;
  }

  /**
   * Quick check using bytecode prefix (faster but less accurate)
   * Use this for initial filtering
   */
  isBaseAppTokenByPrefix(code: string): boolean {
    if (!code || code === '0x' || code.length < 20) {
      return false;
    }
    
    const codeLower = code.toLowerCase();
    return codeLower.startsWith(BASEAPP_PREFIX_LOWER) ||
           codeLower === BASEAPP_FINGERPRINT_LOWER;
  }

  /**
   * Clear the code cache
   */
  clearCache(): void {
    this.codeCache.clear();
  }
}

