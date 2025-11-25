'use client';

import { useState, useEffect } from 'react';
import { getBaseName, getAvatarUrl } from '@/lib/getAvatar';
import { getUserProfile } from '@/lib/baseAccount';
import { getMiniAppUserProfile } from '@/lib/miniapp';

interface UserProfileProps {
  address: string;
  userProfile?: {
    fid?: number;
    username?: string;
    displayName?: string;
    pfpUrl?: string;
    bio?: string;
  } | null;
}

export default function UserProfile({ address, userProfile: propUserProfile }: UserProfileProps) {
  const [basename, setBasename] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchUserData = async () => {
      if (!address || !address.startsWith('0x')) {
        console.log('⚠️ UserProfile: No valid address provided');
        return;
      }
      
      console.log('🔍 UserProfile: Fetching user data for address:', address);
      setIsLoading(true);
      try {
        // Use profile from props if available, otherwise try to get from SDK
        let userProfile = propUserProfile;
        console.log('📦 UserProfile: propUserProfile:', propUserProfile);
        
        if (!userProfile) {
          console.log('📦 UserProfile: propUserProfile is null, trying to get from SDK...');
          // First try Mini App SDK (for Mini Apps - recommended)
          userProfile = await getMiniAppUserProfile();
          console.log('📦 UserProfile: getMiniAppUserProfile result:', userProfile);
          
          // Fallback to Base Account SDK
          if (!userProfile) {
            console.log('📦 UserProfile: Trying Base Account SDK...');
            userProfile = await getUserProfile();
            console.log('📦 UserProfile: getUserProfile result:', userProfile);
          }
        }
        
        if (userProfile) {
          console.log('✅ UserProfile: Using user profile:', userProfile);
          
          // Use profile data from Base App
          if (userProfile.pfpUrl) {
            console.log('✅ UserProfile: Setting avatar from pfpUrl:', userProfile.pfpUrl);
            setAvatarUrl(userProfile.pfpUrl);
          } else {
            console.log('⚠️ UserProfile: No pfpUrl, falling back to ENS/generated avatar');
            // Fallback to ENS avatar or generated avatar
            const avatar = await getAvatarUrl(address);
            setAvatarUrl(avatar);
          }
          
          // Use displayName or username from Base App
          if (userProfile.displayName) {
            console.log('✅ UserProfile: Setting displayName:', userProfile.displayName);
            setDisplayName(userProfile.displayName);
          } else if (userProfile.username) {
            console.log('✅ UserProfile: Setting displayName from username:', userProfile.username);
            setDisplayName(userProfile.username);
          } else {
            console.log('⚠️ UserProfile: No displayName or username in profile');
          }
        } else {
          console.log('⚠️ UserProfile: No user profile found, falling back to Base name/ENS');
          // Fallback: get Base name and avatar via ENS
          const [name, avatar] = await Promise.all([
            getBaseName(address),
            getAvatarUrl(address),
          ]);
          
          if (name) {
            console.log('✅ UserProfile: Got Base name:', name);
            setBasename(name);
          }
          
          if (avatar) {
            console.log('✅ UserProfile: Got avatar:', avatar);
            setAvatarUrl(avatar);
          }
        }
      } catch (error: any) {
        console.error('❌ UserProfile: Error fetching user data:', error);
        // Fallback to generated avatar
        const fallbackAvatar = await getAvatarUrl(address);
        setAvatarUrl(fallbackAvatar);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserData();
  }, [address, propUserProfile]);

  // Determine display name
  const finalDisplayName = displayName || basename || `${address.slice(0, 6)}...${address.slice(-4)}`;
  const shortAddress = `${address.slice(0, 6)}...${address.slice(-4)}`;
  const finalAvatarUrl = avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${address}`;

  return (
    <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/10">
      <img
        src={finalAvatarUrl}
        alt={finalDisplayName}
        className="w-10 h-10 rounded-full border-2 border-white/20 object-cover"
        onError={(e) => {
          // Fallback if image fails to load
          (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${address}`;
        }}
      />
      <div className="flex flex-col flex-1">
        <div className="flex items-center gap-2">
          <span className="text-white font-semibold text-sm">{finalDisplayName}</span>
          {(basename || displayName) && (
            <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full border border-blue-500/30">
              {displayName ? 'Base App' : '.base'}
            </span>
          )}
        </div>
        {(basename || displayName) && (
          <span className="text-xs text-gray-400 font-mono">{shortAddress}</span>
        )}
      </div>
      {isLoading && (
        <span className="text-xs text-gray-500">Loading...</span>
      )}
    </div>
  );
}

