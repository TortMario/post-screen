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
  async isBaseAppToken(address: string, retries: number = 2): Promise<boolean> {
    // Check cache first
    const cacheKey = address.toLowerCase();
    if (this.codeCache.has(cacheKey)) {
      return this.codeCache.get(cacheKey)!;
    }

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        // Get code with retry logic
        let code: string;
        try {
          code = await this.provider.getCode(address);
        } catch (rpcError: any) {
          if (attempt < retries && (rpcError.code === 'TIMEOUT' || rpcError.message?.includes('timeout'))) {
            console.log(`Retry ${attempt + 1}/${retries} for ${address.slice(0, 10)}... (RPC timeout)`);
            await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1))); // Exponential backoff
            continue;
          }
          throw rpcError;
        }
        
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
        
        // Additional verification: check platformReferrer if available (skip on mobile for speed)
        const isMobile = typeof window !== 'undefined' && typeof navigator !== 'undefined' &&
                         (window.innerWidth < 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
        
        // Skip referrer check on mobile to speed things up - bytecode is sufficient
        if (!isMobile) {
          try {
            const isBaseAppByReferrer = await Promise.race([
              isBaseAppTokenByReferrer(address, this.provider),
              new Promise<boolean>((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
            ]);
            if (hasBaseAppBytecode && isBaseAppByReferrer) {
              console.log(`✓ Token ${address.slice(0, 10)}... confirmed as BaseApp by both bytecode and platformReferrer`);
            } else if (hasBaseAppBytecode) {
              console.log(`✓ Token ${address.slice(0, 10)}... confirmed as BaseApp by bytecode (platformReferrer check failed or not available)`);
            }
          } catch (error) {
            // If referrer check fails, still trust bytecode match (bytecode is the primary indicator)
            console.log(`✓ Token ${address.slice(0, 10)}... confirmed as BaseApp by bytecode (platformReferrer check skipped or failed)`);
          }
        } else {
          console.log(`✓ Token ${address.slice(0, 10)}... confirmed as BaseApp by bytecode (mobile - referrer check skipped)`);
        }
        
        this.codeCache.set(cacheKey, hasBaseAppBytecode);
        return hasBaseAppBytecode;
      } catch (error: any) {
        if (attempt < retries && (error.code === 'TIMEOUT' || error.message?.includes('timeout') || error.message?.includes('network'))) {
          console.log(`Retry ${attempt + 1}/${retries} for ${address.slice(0, 10)}... (${error.message})`);
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1))); // Exponential backoff
          continue;
        }
        console.error(`Error checking bytecode for ${address}:`, error);
        // Don't cache errors, allow retry on next call
        if (attempt === retries) {
          this.codeCache.set(cacheKey, false);
        }
        if (attempt === retries) return false;
      }
    }
    
    this.codeCache.set(cacheKey, false);
    return false;
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
    
    // Smaller batches and longer delays for mobile/network reliability
    // Detect mobile or slower connections
    const isMobile = typeof window !== 'undefined' && typeof navigator !== 'undefined' &&
                     (window.innerWidth < 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
    
    const BATCH_SIZE = isMobile ? 3 : 5; // Smaller batches on mobile
    const DELAY_MS = isMobile ? 500 : 200; // Longer delays on mobile
    
    for (let i = 0; i < addresses.length; i += BATCH_SIZE) {
      const batch = addresses.slice(i, i + BATCH_SIZE);
      console.log(`  Checking batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(addresses.length / BATCH_SIZE)} (${batch.length} tokens)...`);
      
      const promises = batch.map(async (addr) => {
        try {
          // Add timeout for mobile connections
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), isMobile ? 15000 : 10000)
          );
          
          const checkPromise = this.isBaseAppToken(addr).then(isBaseApp => ({ addr, isBaseApp }));
          
          return await Promise.race([checkPromise, timeoutPromise]) as { addr: string; isBaseApp: boolean };
        } catch (error) {
          console.warn(`Failed to check ${addr.slice(0, 10)}... (will retry):`, error);
          // Retry once on error
          try {
            const isBaseApp = await this.isBaseAppToken(addr);
            return { addr, isBaseApp };
          } catch (retryError) {
            console.error(`Retry failed for ${addr.slice(0, 10)}...:`, retryError);
            return { addr, isBaseApp: false };
          }
        }
      });
      
      const batchResults = await Promise.allSettled(promises);
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.set(result.value.addr.toLowerCase(), result.value.isBaseApp);
        } else {
          console.error('Batch check error:', result.reason);
        }
      }
      
      // Delay between batches to avoid rate limits (longer on mobile)
      if (i + BATCH_SIZE < addresses.length) {
        await new Promise(resolve => setTimeout(resolve, DELAY_MS));
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

