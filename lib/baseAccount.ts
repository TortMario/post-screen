// Base Account SDK is loaded via CDN in _document.tsx
// The SDK is available as window.createBaseAccountSDK on the client side

export interface BaseAccountConfig {
  appName: string;
  appLogoUrl?: string;
}

let baseAccountSDK: any = null;
let provider: any = null;

/**
 * Initialize Base Account SDK
 * Should be called on the client side only
 * SDK is loaded via CDN in _document.tsx
 */
export function initializeBaseAccount(config: BaseAccountConfig) {
  if (typeof window === 'undefined') {
    throw new Error('Base Account SDK can only be initialized on the client side');
  }

  if (!baseAccountSDK) {
    // Use CDN version (window.createBaseAccountSDK)
    const sdkFactory = (window as any).createBaseAccountSDK;
    
    if (!sdkFactory) {
      throw new Error(
        'Base Account SDK not found. Make sure the SDK script is loaded via CDN in _document.tsx.'
      );
    }

    baseAccountSDK = sdkFactory({
      appName: config.appName,
      appLogoUrl: config.appLogoUrl,
    });
    
    if (!baseAccountSDK || typeof baseAccountSDK.getProvider !== 'function') {
      throw new Error('Failed to initialize Base Account SDK. Invalid SDK instance.');
    }
    
    provider = baseAccountSDK.getProvider();
  }

  return { sdk: baseAccountSDK, provider };
}

/**
 * Get Base Account Provider
 */
export function getBaseAccountProvider() {
  if (!provider) {
    throw new Error('Base Account SDK not initialized. Call initializeBaseAccount first.');
  }
  return provider;
}

/**
 * Generate a fresh nonce for authentication
 */
export function generateNonce(): string {
  if (typeof window === 'undefined' || !window.crypto) {
    // Fallback for environments without crypto API
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }
  return window.crypto.randomUUID().replace(/-/g, '');
}

/**
 * Sign in with Base using wallet_connect with signInWithEthereum capabilities
 */
export async function signInWithBase(nonce?: string): Promise<{
  address: string;
  message: string;
  signature: string;
}> {
  const authNonce = nonce || generateNonce();

  try {
    // Get provider from Base Account SDK
    const provider = getBaseAccountProvider();
    
    // Use wallet_connect method with signInWithEthereum capabilities
    const authResult = await provider.request({
      method: 'wallet_connect',
      params: [{
        version: '1',
        capabilities: {
          signInWithEthereum: {
            nonce: authNonce,
            chainId: '0x2105', // Base Mainnet - 8453
          },
        },
      }],
    });

    const { accounts } = authResult;
    
    if (!accounts || accounts.length === 0) {
      throw new Error('No accounts returned from provider');
    }

    const { address, capabilities } = accounts[0];
    const { message, signature } = capabilities?.signInWithEthereum || {};

    if (!address || !message || !signature) {
      throw new Error('Invalid authentication response from Base Account');
    }

    return { address, message, signature };
  } catch (error: any) {
    console.error('Sign-in error:', error);
    
    // Handle user rejection
    if (error.code === 4001 || error.message?.includes('reject') || error.message?.includes('denied') || error.message?.includes('User denied')) {
      throw new Error('User rejected the connection request');
    }
    
    // Handle method not supported - fallback to standard connection
    if (error.message?.includes('not supported') || error.message?.includes('Method not found')) {
      // Fallback to standard EIP-1193 method
      try {
        const provider = getBaseAccountProvider();
        const accounts = await provider.request({
          method: 'eth_requestAccounts',
        });

        if (!accounts || accounts.length === 0) {
          throw new Error('No accounts returned');
        }

        const address = accounts[0];
        const domain = typeof window !== 'undefined' ? window.location.host : 'localhost';
        const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
        const message = `${domain} wants you to sign in with your Ethereum account:
${address}

URI: ${origin}
Version: 1
Chain ID: 8453
Nonce: ${authNonce}
Issued At: ${new Date().toISOString()}`;

        const signature = await provider.request({
          method: 'personal_sign',
          params: [message, address],
        });

        return { address, message, signature };
      } catch (fallbackError: any) {
        throw new Error('Wallet connection method not supported. Please make sure you have Base app or extension installed.');
      }
    }
    
    throw new Error(error.message || 'Failed to sign in with Base');
  }
}

/**
 * Check if Base Pay is available (window.base API)
 */
export function isBasePayAvailable(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  return typeof (window as any).base?.pay === 'function';
}

/**
 * Pay with Base (one-tap USDC payment)
 */
export async function payWithBase(params: {
  amount: string; // USD amount
  to: string; // Recipient address
  testnet?: boolean;
}): Promise<{ id: string }> {
  if (!isBasePayAvailable()) {
    throw new Error('Base Pay is not available. Make sure Base Account SDK is loaded.');
  }

  try {
    const result = await (window as any).base.pay({
      amount: params.amount,
      to: params.to,
      testnet: params.testnet ?? false,
    });

    return result;
  } catch (error: any) {
    console.error('Payment error:', error);
    throw new Error(error.message || 'Payment failed');
  }
}

/**
 * Get payment status
 */
export async function getPaymentStatus(params: {
  id: string;
  testnet?: boolean;
}): Promise<{ status: string }> {
  if (!isBasePayAvailable()) {
    throw new Error('Base Pay is not available. Make sure Base Account SDK is loaded.');
  }

  try {
    const status = await (window as any).base.getPaymentStatus({
      id: params.id,
      testnet: params.testnet ?? false,
    });

    return status;
  } catch (error: any) {
    console.error('Get payment status error:', error);
    throw new Error(error.message || 'Failed to get payment status');
  }
}

