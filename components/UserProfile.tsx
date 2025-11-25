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
        // Create public client for Base
        const client = createPublicClient({
          chain: base,
          transport: http('https://mainnet.base.org'),
        });

        // Try to resolve Base name (ENS name on Base)
        const name = await client.getEnsName({
          address: address as `0x${string}`,
          coinType: toCoinType(base.id),
        });

        if (name) {
          setBasename(name);
          console.log('Resolved Base name:', name);
        }
      } catch (error) {
        console.error('Error fetching Base name:', error);
        // Silently fail - not all addresses have Base names
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

