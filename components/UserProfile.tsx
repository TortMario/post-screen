'use client';

import { useState, useEffect } from 'react';

interface UserProfileProps {
  address: string;
}

export default function UserProfile({ address }: UserProfileProps) {
  const [ensName, setEnsName] = useState<string | null>(null);
  const [avatar, setAvatar] = useState<string | null>(null);

  useEffect(() => {
    // Try to resolve ENS name (simplified - can be enhanced)
    const fetchENS = async () => {
      try {
        // For now, just use address - can add ENS resolution later
        setEnsName(null);
      } catch (error) {
        console.error('Error fetching ENS:', error);
      }
    };
    fetchENS();
  }, [address]);

  // Generate avatar from address (deterministic)
  const getAvatarUrl = (addr: string) => {
    // Simple deterministic avatar using address hash
    return `https://api.dicebear.com/7.x/avataaars/svg?seed=${addr}`;
  };

  const displayName = ensName || `${address.slice(0, 6)}...${address.slice(-4)}`;
  const shortAddress = `${address.slice(0, 6)}...${address.slice(-4)}`;

  return (
    <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/10">
      <img
        src={getAvatarUrl(address)}
        alt={displayName}
        className="w-10 h-10 rounded-full border-2 border-white/20"
      />
      <div className="flex flex-col">
        <span className="text-white font-semibold text-sm">{displayName}</span>
        {ensName && (
          <span className="text-xs text-gray-400 font-mono">{shortAddress}</span>
        )}
      </div>
    </div>
  );
}

