import { ethers } from 'ethers';

const BASE_RPC_URL = 'https://mainnet.base.org';

// Uniswap V4 addresses on Base Mainnet (official, confirmed by Base + Uniswap Labs)
export const UNISWAP_V4_POOL_MANAGER = '0xA5B4F34780D948b571E676C34aB709D3AcA0498D';
export const UNISWAP_V4_STATE_VIEW = '0x43F150e8e18cB95A0c1Fb2176A6531864d618C39';

// Uniswap V4 StateView ABI (for reading pool state)
const STATE_VIEW_ABI = [
  'function getSlot0(bytes32 poolId) external view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)',
  'function getLiquidity(bytes32 poolId) external view returns (uint128 liquidity)',
];

// Zora Base Coin ABI (for detecting Base App tokens)
const ZORA_BASE_COIN_ABI = [
  'function platformReferrer() view returns (address)',
];

// Base App platform referrer address (official)
// This is used to identify tokens created via Base App vs Zora
// Any token with platformReferrer() == 0x...bA5e is a Base App post token
export const BASE_PLATFORM_REFERRER = '0x000000000000000000000000000000000000bA5e';

// WETH address on Base
const WETH_BASE = '0x4200000000000000000000000000000000000006';

// Zora hook addresses for Base App coins
const ZORA_HOOKS = {
  CREATOR_COIN: '0xd61A675F8a0c67A73DC3B54FB7318B4D91409040',
  V4_COIN: '0x9ea932730A7787000042e34390B8E435dD839040',
};

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
 * Calculate pool ID for Uniswap V4
 * poolId = keccak256(abi.encodePacked(currency0, fee, tickSpacing, currency1, hooks))
 */
function getPoolId(
  currency0: string,
  currency1: string,
  fee: number,
  tickSpacing: number,
  hooks: string
): string {
  // Encode pool key components
  const encoded = ethers.solidityPacked(
    ['address', 'uint24', 'int24', 'address', 'address'],
    [currency0, fee, tickSpacing, currency1, hooks]
  );
  return ethers.keccak256(encoded);
}

/**
 * Check if token is a Base App token by checking platformReferrer
 * Base App tokens are created via Zora and have a specific platformReferrer address
 */
export async function isBaseAppTokenByReferrer(
  tokenAddress: string,
  provider?: ethers.JsonRpcProvider
): Promise<boolean> {
  if (!provider) {
    provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
  }
  
  try {
    const token = new ethers.Contract(tokenAddress, ZORA_BASE_COIN_ABI, provider);
    const platformReferrer = await token.platformReferrer();
    
    // Check if platformReferrer matches Base App referrer
    return platformReferrer.toLowerCase() === BASE_PLATFORM_REFERRER.toLowerCase();
  } catch (error) {
    // Function doesn't exist or token is not a Zora coin
    return false;
  }
}

/**
 * Get token price from Uniswap V4 pool by reading sqrtPriceX96 via StateView
 * This is the recommended approach for Base App tokens
 */
/**
 * Get token price from Uniswap V4 pool by reading sqrtPriceX96 via StateView
 * This is the recommended approach for Base App tokens
 */
export async function getUniswapPriceFromPool(
  tokenAddress: string,
  wethAddress: string = WETH_BASE
): Promise<{ priceInWETH: number; priceInUSD: number } | null> {
  try {
    const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
    
    // Check if token is a Base App token
    const isBaseApp = await isBaseAppTokenByReferrer(tokenAddress, provider);
    if (isBaseApp) {
      console.log(`Token ${tokenAddress.slice(0, 10)}... is a Base App token`);
    }
    
    // Try Uniswap V4 pools first using StateView
    try {
      // For Base App tokens, they typically use Zora hooks
      const hookConfigs = [
        { hook: ZORA_HOOKS.CREATOR_COIN, fee: 3000, tickSpacing: 60 },
        { hook: ZORA_HOOKS.V4_COIN, fee: 3000, tickSpacing: 60 },
      ];
      
      // Also try standard Uniswap V4 pools (no hooks)
      const standardConfigs = [
        { hook: ethers.ZeroAddress, fee: 500, tickSpacing: 10 },
        { hook: ethers.ZeroAddress, fee: 3000, tickSpacing: 60 },
        { hook: ethers.ZeroAddress, fee: 10000, tickSpacing: 200 },
      ];
      
      const allConfigs = [...hookConfigs, ...standardConfigs];
      
      // Try to find pool using StateView
      const stateView = new ethers.Contract(UNISWAP_V4_STATE_VIEW, STATE_VIEW_ABI, provider);
      
      for (const config of allConfigs) {
        try {
          const poolId = getPoolId(tokenAddress, wethAddress, config.fee, config.tickSpacing, config.hook);
          const slot0 = await stateView.getSlot0(poolId);
          
          if (slot0 && slot0.sqrtPriceX96) {
            const token0 = tokenAddress.toLowerCase() < wethAddress.toLowerCase() ? tokenAddress : wethAddress;
            const token0IsBase = token0.toLowerCase() === wethAddress.toLowerCase();
            
            const tokenAbi = ['function decimals() view returns (uint8)'];
            const tokenContract = new ethers.Contract(tokenAddress, tokenAbi, provider);
            const tokenDecimals = await tokenContract.decimals();
            const wethDecimals = 18;
            
            const priceInWETH = calculatePriceFromSqrtPriceX96(
              slot0.sqrtPriceX96,
              token0IsBase ? wethDecimals : tokenDecimals,
              token0IsBase ? tokenDecimals : wethDecimals,
              token0IsBase
            );
            
            const wethPriceUSD = await getWETHPriceUSD();
            const priceInUSD = priceInWETH * wethPriceUSD;
            
            console.log(`Uniswap V4 price for ${tokenAddress.slice(0, 10)}...: ${priceInWETH} WETH = $${priceInUSD}`);
            return { priceInWETH, priceInUSD };
          }
        } catch (e) {
          // Continue to next config
          continue;
        }
      }
    } catch (error) {
      console.warn('Uniswap V4 price lookup failed, trying V3:', error);
    }
    
    // Fallback: Try Uniswap V3 pools (many tokens still use V3)
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

