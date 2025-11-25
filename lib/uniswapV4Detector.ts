import { ethers } from 'ethers';
import { createPublicClient, http, Address } from 'viem';
import { base } from 'viem/chains';

const BASE_RPC_URL = 'https://mainnet.base.org';

// Uniswap V4 addresses on Base Mainnet
export const UNISWAP_V4_POOL_MANAGER = '0xA5B4F34780D948b571E676C34aB709D3AcA0498D' as Address;
export const UNISWAP_V4_STATE_VIEW = '0x43F150e8e18cB95A0c1Fb2176A6531864d618C39' as Address;

// Base App platform referrer address (official)
export const BASE_PLATFORM_REFERRER = '0x000000000000000000000000000000000000bA5e' as Address;

// Zora hook addresses for Base App coins
export const ZORA_HOOKS = {
  CREATOR_COIN: '0xd61A675F8a0c67A73DC3B54FB7318B4D91409040' as Address,
  V4_COIN: '0x9ea932730A7787000042e34390B8E435dD839040' as Address,
};

// WETH address on Base
const WETH_BASE = '0x4200000000000000000000000000000000000006' as Address;

// Uniswap V4 PoolManager ABI (for Initialize event)
const UNISWAP_V4_POOL_MANAGER_ABI = [
  {
    type: 'event',
    name: 'Initialize',
    inputs: [
      { name: 'poolId', type: 'bytes32', indexed: true },
      { name: 'currency0', type: 'address', indexed: false },
      { name: 'currency1', type: 'address', indexed: false },
      { name: 'fee', type: 'uint24', indexed: false },
      { name: 'tickSpacing', type: 'int24', indexed: false },
      { name: 'hooks', type: 'address', indexed: false },
    ],
  },
] as const;

// Uniswap V4 StateView ABI
const STATE_VIEW_ABI = [
  {
    name: 'getSlot0',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'poolId', type: 'bytes32' }],
    outputs: [
      { name: 'sqrtPriceX96', type: 'uint160' },
      { name: 'tick', type: 'int24' },
      { name: 'protocolFee', type: 'uint24' },
      { name: 'lpFee', type: 'uint24' },
    ],
  },
  {
    name: 'getLiquidity',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'poolId', type: 'bytes32' }],
    outputs: [{ name: 'liquidity', type: 'uint128' }],
  },
] as const;

// Zora Base Coin ABI (for detecting Base App tokens)
const ZORA_BASE_COIN_ABI = [
  {
    name: 'platformReferrer',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
] as const;

// ERC20 ABI
const ERC20_ABI = [
  {
    name: 'name',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    name: 'symbol',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
] as const;

export interface PoolKey {
  currency0: Address;
  currency1: Address;
  fee: number;
  tickSpacing: number;
  hooks: Address;
}

export interface PoolMetadata {
  poolId: `0x${string}`;
  key: PoolKey;
  currency0: {
    name: string;
    symbol: string;
    decimals: number;
    address: Address;
  };
  currency1: {
    name: string;
    symbol: string;
    decimals: number;
    address: Address;
  };
  sqrtPriceX96: bigint;
  tick: number;
  liquidity: bigint;
  coinType?: 'ZORA_CREATOR_COIN' | 'ZORA_V4_COIN';
  appType?: 'TBA' | 'ZORA';
}

/**
 * Create viem public client for Base chain
 */
function createBaseClient() {
  return createPublicClient({
    chain: base,
    transport: http(BASE_RPC_URL),
  });
}

/**
 * Get currency information (name, symbol, decimals)
 */
async function getCurrency(address: Address, client: ReturnType<typeof createBaseClient>): Promise<{
  name: string;
  symbol: string;
  decimals: number;
  address: Address;
}> {
  // Handle native ETH (zero address)
  if (address.toLowerCase() === '0x0000000000000000000000000000000000000000') {
    return {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
      address: address,
    };
  }

  try {
    const contract = {
      address,
      abi: ERC20_ABI,
    } as const;

    const [name, symbol, decimals] = await Promise.all([
      client.readContract({ ...contract, functionName: 'name' }).catch(() => 'Unknown'),
      client.readContract({ ...contract, functionName: 'symbol' }).catch(() => 'UNKNOWN'),
      client.readContract({ ...contract, functionName: 'decimals' }).catch(() => 18),
    ]);

    return {
      name: typeof name === 'string' ? name : 'Unknown',
      symbol: typeof symbol === 'string' ? symbol : 'UNKNOWN',
      decimals: typeof decimals === 'number' ? decimals : 18,
      address,
    };
  } catch (error) {
    console.warn(`Failed to get currency info for ${address}:`, error);
    return {
      name: 'Unknown',
      symbol: 'UNKNOWN',
      decimals: 18,
      address,
    };
  }
}

/**
 * Calculate pool ID for Uniswap V4
 * poolId = keccak256(abi.encodePacked(currency0, fee, tickSpacing, currency1, hooks))
 */
export function getPoolId(key: PoolKey): `0x${string}` {
  const encoded = ethers.solidityPacked(
    ['address', 'uint24', 'int24', 'address', 'address'],
    [key.currency0, key.fee, key.tickSpacing, key.currency1, key.hooks]
  );
  return ethers.keccak256(encoded) as `0x${string}`;
}

/**
 * Try to get platformReferrer from a token address
 * Returns ADDRESS_ZERO if the function doesn't exist (token is not a Zora coin)
 */
async function tryGetPlatformReferrer(
  address: Address,
  client: ReturnType<typeof createBaseClient>
): Promise<Address> {
  try {
    const contract = {
      address,
      abi: ZORA_BASE_COIN_ABI,
    } as const;

    const platformReferrer = await client.readContract({
      ...contract,
      functionName: 'platformReferrer',
    });

    return platformReferrer as Address;
  } catch (error) {
    // Function doesn't exist or token is not a Zora coin
    return '0x0000000000000000000000000000000000000000' as Address;
  }
}

/**
 * Categorize app type (Base App vs Zora) by checking platformReferrer
 * This is the correct method according to Base documentation
 */
export async function categorizeAppType(
  currency0: Address,
  currency1: Address,
  client: ReturnType<typeof createBaseClient>
): Promise<'TBA' | 'ZORA'> {
  // Try to fetch platformReferrer() on both currencies in the Pool
  // falling back to ADDRESS_ZERO if the function does not exist (currency is not a Zora coin)
  const [currency0PlatformReferrer, currency1PlatformReferrer] = await Promise.all([
    tryGetPlatformReferrer(currency0, client),
    tryGetPlatformReferrer(currency1, client),
  ]);

  // If either of the currencies has the Base App referrer address,
  // the coin is coming from the Base App
  if (
    currency0PlatformReferrer.toLowerCase() === BASE_PLATFORM_REFERRER.toLowerCase() ||
    currency1PlatformReferrer.toLowerCase() === BASE_PLATFORM_REFERRER.toLowerCase()
  ) {
    return 'TBA';
  }

  return 'ZORA';
}

/**
 * Determine coin type based on hooks address
 */
export function getCoinType(hooks: Address): 'ZORA_CREATOR_COIN' | 'ZORA_V4_COIN' | undefined {
  const hooksLower = hooks.toLowerCase();
  if (hooksLower === ZORA_HOOKS.CREATOR_COIN.toLowerCase()) {
    return 'ZORA_CREATOR_COIN';
  } else if (hooksLower === ZORA_HOOKS.V4_COIN.toLowerCase()) {
    return 'ZORA_V4_COIN';
  }
  return undefined;
}

/**
 * Load pool data from Uniswap V4 StateView
 */
export async function loadPoolData(
  key: PoolKey,
  client: ReturnType<typeof createBaseClient>
): Promise<PoolMetadata | null> {
  try {
    const poolId = getPoolId(key);

    // Load information about each token
    const [currency0Info, currency1Info] = await Promise.all([
      getCurrency(key.currency0, client),
      getCurrency(key.currency1, client),
    ]);

    // Load the current price of the pool
    const stateView = {
      address: UNISWAP_V4_STATE_VIEW,
      abi: STATE_VIEW_ABI,
    } as const;

    try {
      const [sqrtPriceX96, tick, _protocolFee, _lpFee] = await client.readContract({
        ...stateView,
        functionName: 'getSlot0',
        args: [poolId],
      });

      // Load the total amount of liquidity available in the pool
      const liquidity = await client.readContract({
        ...stateView,
        functionName: 'getLiquidity',
        args: [poolId],
      });

      // Check if pool is initialized (has liquidity)
      if (liquidity === 0n) {
        // Pool exists but has no liquidity
        return null;
      }

      // Determine coin type
      const coinType = getCoinType(key.hooks);

      // Categorize app type
      const appType = await categorizeAppType(key.currency0, key.currency1, client);

      return {
        poolId,
        key,
        currency0: currency0Info,
        currency1: currency1Info,
        sqrtPriceX96: sqrtPriceX96 as bigint,
        tick: Number(tick),
        liquidity: liquidity as bigint,
        coinType,
        appType,
      };
    } catch (contractError: any) {
      // Pool doesn't exist or is not initialized
      // This is expected for many pool configurations
      return null;
    }
  } catch (error) {
    // Error loading currency info or other non-contract errors
    console.error(`Error loading pool data for pool ${key.currency0}-${key.currency1}:`, error);
    return null;
  }
}

/**
 * Try to find pool using known configurations first (faster)
 * Falls back to event scanning if needed
 */
async function tryFindPoolByConfig(
  tokenAddress: Address,
  client: ReturnType<typeof createBaseClient>
): Promise<PoolMetadata | null> {
  // Try known Zora hook configurations first (most common for Base App tokens)
  const knownConfigs: Array<{ hook: Address; fee: number; tickSpacing: number }> = [
    { hook: ZORA_HOOKS.CREATOR_COIN, fee: 3000, tickSpacing: 60 },
    { hook: ZORA_HOOKS.V4_COIN, fee: 3000, tickSpacing: 60 },
  ];

  // Try both token-WETH and WETH-token orderings
  for (const config of knownConfigs) {
    for (const [currency0, currency1] of [
      [tokenAddress, WETH_BASE],
      [WETH_BASE, tokenAddress],
    ] as [Address, Address][]) {
      try {
        const poolKey: PoolKey = {
          currency0,
          currency1,
          fee: config.fee,
          tickSpacing: config.tickSpacing,
          hooks: config.hook,
        };

        const poolData = await loadPoolData(poolKey, client);
        if (poolData && poolData.liquidity > 0n) {
          // Pool exists and has liquidity
          return poolData;
        }
      } catch (error) {
        // Pool doesn't exist with this config, continue
        continue;
      }
    }
  }

  return null;
}

/**
 * Find Uniswap V4 pool for a token address
 * First tries known configurations (fast), then searches through Initialize events if needed
 */
export async function findPoolForToken(
  tokenAddress: Address,
  startBlock?: bigint,
  endBlock?: bigint
): Promise<PoolMetadata | null> {
  const client = createBaseClient();

  // First, try known configurations (much faster)
  console.log(`Trying known pool configurations for token ${tokenAddress}...`);
  const poolByConfig = await tryFindPoolByConfig(tokenAddress, client);
  if (poolByConfig) {
    console.log(`Found pool using known configuration for ${tokenAddress}`);
    return poolByConfig;
  }

  // If not found, search through events (slower but more thorough)
  console.log(`Pool not found via known configs, searching Initialize events...`);
  
  // If endBlock not provided, get current block
  if (!endBlock) {
    endBlock = await client.getBlockNumber();
  }

  // Optimize: only search recent blocks (last 1M blocks ~= 2 weeks) for performance
  // Most Base App tokens are created recently
  const RECENT_BLOCKS = 1_000_000n;
  const optimizedStartBlock = startBlock || (endBlock > RECENT_BLOCKS ? endBlock - RECENT_BLOCKS : 0n);

  try {
    // Get all Initialize events from Uniswap V4 PoolManager
    const logs = await client.getContractEvents({
      address: UNISWAP_V4_POOL_MANAGER,
      abi: UNISWAP_V4_POOL_MANAGER_ABI,
      eventName: 'Initialize',
      fromBlock: optimizedStartBlock,
      toBlock: endBlock,
    });

    console.log(`Found ${logs.length} Initialize events, searching for token ${tokenAddress}...`);

    // Filter pools that contain our token
    const tokenLower = tokenAddress.toLowerCase();
    const relevantPools: PoolKey[] = [];

    for (const log of logs) {
      const currency0 = (log.args.currency0 as Address).toLowerCase();
      const currency1 = (log.args.currency1 as Address).toLowerCase();

      if (currency0 === tokenLower || currency1 === tokenLower) {
        relevantPools.push({
          currency0: log.args.currency0 as Address,
          currency1: log.args.currency1 as Address,
          fee: Number(log.args.fee),
          tickSpacing: Number(log.args.tickSpacing),
          hooks: log.args.hooks as Address,
        });
      }
    }

    if (relevantPools.length === 0) {
      console.log(`No pools found for token ${tokenAddress}`);
      return null;
    }

    // Try to load data for each pool (prioritize Zora pools)
    const zoraPools = relevantPools.filter(
      (p) =>
        p.hooks.toLowerCase() === ZORA_HOOKS.CREATOR_COIN.toLowerCase() ||
        p.hooks.toLowerCase() === ZORA_HOOKS.V4_COIN.toLowerCase()
    );

    const poolsToCheck = zoraPools.length > 0 ? zoraPools : relevantPools;

    for (const poolKey of poolsToCheck) {
      const poolData = await loadPoolData(poolKey, client);
      if (poolData) {
        // Check if this is a Base App token
        if (poolData.appType === 'TBA') {
          console.log(`Found Base App token pool for ${tokenAddress}`);
          return poolData;
        }
      }
    }

    // If no Base App pool found, return the first valid pool
    for (const poolKey of poolsToCheck) {
      const poolData = await loadPoolData(poolKey, client);
      if (poolData) {
        return poolData;
      }
    }

    return null;
  } catch (error) {
    console.error(`Error finding pool for token ${tokenAddress}:`, error);
    return null;
  }
}

/**
 * Check if a token is a Base App token by finding its pool and checking platformReferrer
 * This is the correct method according to Base documentation
 */
export async function isBaseAppTokenByPool(tokenAddress: Address): Promise<boolean> {
  try {
    const poolData = await findPoolForToken(tokenAddress);
    
    if (!poolData) {
      return false;
    }

    // Check if appType is TBA (Base App)
    return poolData.appType === 'TBA';
  } catch (error) {
    console.error(`Error checking if token ${tokenAddress} is Base App token:`, error);
    return false;
  }
}

/**
 * Get token price from Uniswap V4 pool
 */
export async function getTokenPriceFromPool(
  tokenAddress: Address,
  poolData?: PoolMetadata | null
): Promise<{ priceInWETH: number; priceInUSD: number; liquidity: bigint } | null> {
  try {
    const client = createBaseClient();
    
    // If poolData not provided, find it
    let actualPoolData = poolData;
    if (!actualPoolData) {
      actualPoolData = await findPoolForToken(tokenAddress);
      if (!actualPoolData) {
        return null;
      }
    }

    // Calculate price from sqrtPriceX96
    const Q96 = 2n ** 96n;
    const sqrtPrice = Number(actualPoolData.sqrtPriceX96) / Number(Q96);
    const priceToken1PerToken0 = sqrtPrice * sqrtPrice;

    // Determine which currency is the token and which is WETH
    const tokenLower = tokenAddress.toLowerCase();
    const wethLower = WETH_BASE.toLowerCase();
    
    const token0IsToken = actualPoolData.currency0.address.toLowerCase() === tokenLower;
    const token1IsToken = actualPoolData.currency1.address.toLowerCase() === tokenLower;
    
    if (!token0IsToken && !token1IsToken) {
      console.warn(`Token ${tokenAddress} not found in pool currencies`);
      return null;
    }

    // Adjust for decimals
    const tokenDecimals = token0IsToken ? actualPoolData.currency0.decimals : actualPoolData.currency1.decimals;
    const wethDecimals = 18;
    const decimalsDiff = wethDecimals - tokenDecimals;
    const decimalsAdjustment = Math.pow(10, decimalsDiff);

    let priceInWETH: number;
    
    if (token0IsToken) {
      // Token is currency0, WETH is currency1
      // priceToken1PerToken0 = WETH/Token
      // We want: 1 Token = X WETH, so we invert
      priceInWETH = 1 / (priceToken1PerToken0 * decimalsAdjustment);
    } else {
      // Token is currency1, WETH is currency0
      // priceToken1PerToken0 = Token/WETH
      // We want: 1 Token = X WETH
      priceInWETH = priceToken1PerToken0 * decimalsAdjustment;
    }

    // Get WETH price in USD
    const wethPriceUSD = await getWETHPriceUSD();
    const priceInUSD = priceInWETH * wethPriceUSD;

    return {
      priceInWETH,
      priceInUSD,
      liquidity: actualPoolData.liquidity,
    };
  } catch (error) {
    console.error(`Error getting token price from pool for ${tokenAddress}:`, error);
    return null;
  }
}

/**
 * Get WETH/USD price
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

