import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';

const BASE_RPC_URL = 'https://mainnet.base.org';

/**
 * Get avatar URL for an address or Base name
 * Uses ENS resolver on Base to get avatar
 */
export async function getAvatarUrl(addressOrName: string): Promise<string | null> {
  try {
    const client = createPublicClient({
      chain: base,
      transport: http(BASE_RPC_URL),
    });

    // If it's a name (contains .base or .eth), resolve it first
    let address = addressOrName;
    if (addressOrName.includes('.') && !addressOrName.startsWith('0x')) {
      try {
        const resolvedAddress = await client.getEnsAddress({
          name: addressOrName as `${string}.eth`,
        });
        if (resolvedAddress) {
          address = resolvedAddress;
        }
      } catch (error) {
        console.warn(`Failed to resolve name ${addressOrName}:`, error);
        return null;
      }
    }

    if (!address.startsWith('0x')) {
      return null;
    }

    // Try to get avatar from ENS resolver
    // First resolve name, then get avatar
    try {
      const name = await client.getEnsName({
        address: address as `0x${string}`,
      });
      
      if (name) {
        const avatar = await client.getEnsAvatar({
          name: name as `${string}.eth`,
        });

        if (avatar) {
          return avatar;
        }
      }
    } catch (error) {
      // Avatar not available, will use fallback
      console.log(`No ENS avatar found for ${address}`);
    }

    // Fallback: generate deterministic avatar
    return `https://api.dicebear.com/7.x/avataaars/svg?seed=${address}`;
  } catch (error) {
    console.warn('Error getting avatar:', error);
    // Fallback: generate deterministic avatar
    return `https://api.dicebear.com/7.x/avataaars/svg?seed=${addressOrName}`;
  }
}

/**
 * Get Base name for an address
 */
export async function getBaseName(address: string): Promise<string | null> {
  try {
    const client = createPublicClient({
      chain: base,
      transport: http(BASE_RPC_URL),
    });

    const name = await client.getEnsName({
      address: address as `0x${string}`,
    });

    return name;
  } catch (error) {
    console.warn('Error getting Base name:', error);
    return null;
  }
}

