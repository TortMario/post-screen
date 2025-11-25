import { ethers } from 'ethers';
import { 
  findPoolForToken, 
  getTokenPriceFromPool, 
  isBaseAppTokenByPool,
  BASE_PLATFORM_REFERRER,
  UNISWAP_V4_POOL_MANAGER,
  UNISWAP_V4_STATE_VIEW,
  ZORA_HOOKS,
} from './uniswapV4Detector';
import type { Address } from 'viem';

const BASE_RPC_URL = 'https://mainnet.base.org';

// WETH address on Base
const WETH_BASE = '0x4200000000000000000000000000000000000006';

/**
 * Calculate price from sqrtPriceX96
 * Formula: price = (sqrtPriceX96 / 2^96)^2
 * sqrtPriceX96 represents sqrt(price) * 2^96 where price = token1/token0
 * So price = (sqrtPriceX96 / 2^96)^2
 */
function calculatePriceFromSqrtPriceX96(
  sqrtPriceX96: bigint,
  token0Decimals: number,
  token1Decimals: number,
  token0IsBase: boolean
): number {
  // sqrtPriceX96 is Q64.96 fixed point number
  // It represents sqrt(token1/token0) * 2^96
  const Q96 = 2n ** 96n;
  
  // Convert to JavaScript number (may lose precision for very large numbers)
  const sqrtPrice = Number(sqrtPriceX96) / Number(Q96);
  
  // price = (sqrtPrice)^2 = token1/token0
  const priceToken1PerToken0 = sqrtPrice * sqrtPrice;
  
  // Adjust for token decimals
  // If token0 has 18 decimals and token1 has 6 decimals, we need to adjust
  const decimalsDiff = token1Decimals - token0Decimals;
  const decimalsAdjustment = Math.pow(10, decimalsDiff);
  const adjustedPrice = priceToken1PerToken0 * decimalsAdjustment;
  
  // If token0 is base (WETH), we want price of token1 in terms of token0
  // priceToken1PerToken0 already gives us token1/token0, which is what we want
  // If we want token0/token1 (price of base in terms of token), we invert
  if (token0IsBase) {
    // token0 is WETH, so we want: 1 WETH = X tokens
    // priceToken1PerToken0 gives us: 1 token = X WETH
    // So we need to invert: 1 WETH = 1 / (token1/token0) tokens
    return 1 / adjustedPrice;
  } else {
    // token1 is WETH, so priceToken1PerToken0 already gives us: 1 token = X WETH
    return adjustedPrice;
  }
}


/**
 * Check if token is a Base App token by checking platformReferrer
 * Base App tokens are created via Zora and have a specific platformReferrer address
 * This function now uses the correct method: finding the pool and checking platformReferrer
 */
export async function isBaseAppTokenByReferrer(
  tokenAddress: string,
  provider?: ethers.JsonRpcProvider
): Promise<boolean> {
  try {
    // Use the new method that finds the pool and checks platformReferrer
    return await isBaseAppTokenByPool(tokenAddress as Address);
  } catch (error) {
    console.warn(`Error checking Base App token by referrer for ${tokenAddress}:`, error);
    return false;
  }
}

/**
 * Get token price from Uniswap V4 pool by reading sqrtPriceX96 via StateView
 * This is the recommended approach for Base App tokens
 * Now uses the correct method: finding pools through Initialize events
 */
export async function getUniswapPriceFromPool(
  tokenAddress: string,
  wethAddress: string = WETH_BASE
): Promise<{ priceInWETH: number; priceInUSD: number } | null> {
  try {
    // Use the new method that finds pools through Initialize events
    const priceData = await getTokenPriceFromPool(tokenAddress as Address);
    
    if (priceData) {
      console.log(`Uniswap V4 price for ${tokenAddress.slice(0, 10)}...: ${priceData.priceInWETH} WETH = $${priceData.priceInUSD}`);
      return {
        priceInWETH: priceData.priceInWETH,
        priceInUSD: priceData.priceInUSD,
      };
    }
    
    // Fallback: Try Uniswap V3 pools (many tokens still use V3)
    const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
    return await getUniswapV3Price(tokenAddress, wethAddress, provider);
    
  } catch (error) {
    console.error(`Error getting Uniswap price for ${tokenAddress}:`, error);
    return null;
  }
}

/**
 * Fallback: Get price from Uniswap V3 pool
 */
async function getUniswapV3Price(
  tokenAddress: string,
  wethAddress: string,
  provider: ethers.JsonRpcProvider
): Promise<{ priceInWETH: number; priceInUSD: number } | null> {
  try {
    // Uniswap V3 Factory on Base
    const UNISWAP_V3_FACTORY = '0x33128a8fC17869897dcE68Ed026d694621f6FDfD';
    const FACTORY_ABI = [
      'function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool)',
    ];
    const POOL_ABI = [
      'function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
      'function token0() external view returns (address)',
      'function token1() external view returns (address)',
    ];
    
    const factory = new ethers.Contract(UNISWAP_V3_FACTORY, FACTORY_ABI, provider);
    const fees = [500, 3000, 10000]; // 0.05%, 0.3%, 1%
    
    for (const fee of fees) {
      try {
        const poolAddress = await factory.getPool(tokenAddress, wethAddress, fee);
        if (poolAddress && poolAddress !== ethers.ZeroAddress) {
          const pool = new ethers.Contract(poolAddress, POOL_ABI, provider);
          const slot0 = await pool.slot0();
          const sqrtPriceX96 = slot0.sqrtPriceX96;
          
          const token0 = await pool.token0();
          const token0IsBase = token0.toLowerCase() === wethAddress.toLowerCase();
          
          const tokenAbi = ['function decimals() view returns (uint8)'];
          const tokenContract = new ethers.Contract(tokenAddress, tokenAbi, provider);
          const tokenDecimals = await tokenContract.decimals();
          const wethDecimals = 18;
          
          const priceInWETH = calculatePriceFromSqrtPriceX96(
            sqrtPriceX96,
            token0IsBase ? wethDecimals : tokenDecimals,
            token0IsBase ? tokenDecimals : wethDecimals,
            token0IsBase
          );
          
          const wethPriceUSD = await getWETHPriceUSD();
          const priceInUSD = priceInWETH * wethPriceUSD;
          
          console.log(`Uniswap V3 price for ${tokenAddress.slice(0, 10)}...: ${priceInWETH} WETH = $${priceInUSD}`);
          
          return { priceInWETH, priceInUSD };
        }
      } catch (e) {
        // Continue to next fee tier
      }
    }
    
    return null;
  } catch (error) {
    console.error(`Error getting Uniswap V3 price:`, error);
    return null;
  }
}

/**
 * Get WETH/USD price (simplified - using ETH price as WETH ≈ ETH)
 */
async function getWETHPriceUSD(): Promise<number> {
  try {
    const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
    const data = await res.json();
    return data?.ethereum?.usd || 3000;
  } catch (e) {
    return 3000; // Fallback
  }
}

