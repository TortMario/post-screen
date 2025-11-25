'use client';

import { useState, useEffect } from 'react';
import { createPublicClient, http, toCoinType } from 'viem';
import { base } from 'viem/chains';

interface UserProfileProps {
  address: string;
}

export default function UserProfile({ address }: UserProfileProps) {
  const [basename, setBasename] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchBasename = async () => {
      if (!address || !address.startsWith('0x')) return;
      
      setIsLoading(true);
      try {
        // Try multiple RPC endpoints for Base name resolution
        const rpcUrls = [
          'https://mainnet.base.org',
          'https://base-mainnet.public.blastapi.io',
          'https://base.llamarpc.com',
        ];

        let name: string | null = null;
        let lastError: Error | null = null;

        // Try each RPC endpoint
        for (const rpcUrl of rpcUrls) {
          try {
            const client = createPublicClient({
              chain: base,
              transport: http(rpcUrl),
            });

            // Try to resolve Base name (ENS name on Base) with coinType
            const resolvedName = await Promise.race([
              client.getEnsName({
                address: address as `0x${string}`,
                coinType: toCoinType(base.id),
              }),
              new Promise<string | null>((_, reject) => 
                setTimeout(() => reject(new Error('Timeout')), 10000)
              ),
            ]) as string | null;

            if (resolvedName) {
              name = resolvedName;
              console.log('✅ Resolved Base name:', resolvedName, 'via', rpcUrl);
              break; // Success, no need to try other RPCs
            }
          } catch (rpcError: any) {
            console.warn(`Failed to resolve Base name via ${rpcUrl}:`, rpcError.message);
            lastError = rpcError;
            // Continue to next RPC
          }
        }

        if (name) {
          setBasename(name);
        } else {
          console.log('No Base name found for address (this is normal for addresses without .base names)');
        }
      } catch (error: any) {
        console.warn('Error fetching Base name (non-critical):', error.message);
        // Silently fail - not all addresses have Base names, and resolution may require private RPC
      } finally {
        setIsLoading(false);
      }
    };

    fetchBasename();
  }, [address]);

  // Generate avatar from address (deterministic)
  const getAvatarUrl = (addr: string) => {
    return `https://api.dicebear.com/7.x/avataaars/svg?seed=${addr}`;
  };

  const displayName = basename || `${address.slice(0, 6)}...${address.slice(-4)}`;
  const shortAddress = `${address.slice(0, 6)}...${address.slice(-4)}`;

  return (
    <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/10">
      <img
        src={getAvatarUrl(address)}
        alt={displayName}
        className="w-10 h-10 rounded-full border-2 border-white/20"
      />
      <div className="flex flex-col">
        <div className="flex items-center gap-2">
          <span className="text-white font-semibold text-sm">{displayName}</span>
          {basename && (
            <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full border border-blue-500/30">
              .base
            </span>
          )}
        </div>
        {basename && (
          <span className="text-xs text-gray-400 font-mono">{shortAddress}</span>
        )}
      </div>
      {isLoading && (
        <span className="text-xs text-gray-500">Resolving...</span>
      )}
    </div>
  );
}

