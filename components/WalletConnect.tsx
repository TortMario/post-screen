'use client';

import { useState, useEffect } from 'react';
import { initializeBaseAccount, signInWithBase, getUserProfile } from '@/lib/baseAccount';
import { ethers } from 'ethers';

interface WalletConnectProps {
  onConnect: (address: string, userProfile?: {
    fid?: number;
    username?: string;
    displayName?: string;
    pfpUrl?: string;
    bio?: string;
  }) => void;
}

export default function WalletConnect({ onConnect }: WalletConnectProps) {
  const [address, setAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sdkInitialized, setSdkInitialized] = useState(false);
  const [hasEthereum, setHasEthereum] = useState(false);

  useEffect(() => {
    // Check for wallet availability
    if (typeof window !== 'undefined') {
      if (window.ethereum) {
        setHasEthereum(true);
      }
      
      // Try to initialize Base Account SDK (optional)
      if ((window as any).createBaseAccountSDK && !sdkInitialized) {
        try {
          initializeBaseAccount({
            appName: "BasePost's portfolio screen",
            appLogoUrl: 'https://base.org/logo.png',
          });
          setSdkInitialized(true);
          console.log('Base Account SDK initialized');
        } catch (err) {
          console.warn('Base Account SDK initialization failed (optional):', err);
        }
      }
    }

    // Check for saved address
    const savedAddress = localStorage.getItem('walletAddress');
    if (savedAddress) {
      setAddress(savedAddress);
      onConnect(savedAddress);
    }
  }, [onConnect, sdkInitialized]);

  const handleSignIn = async () => {
    try {
      setConnecting(true);
      setError(null);

      // Try Base Account first (Sign in with Base) if SDK is available
      if (typeof window !== 'undefined' && (window as any).createBaseAccountSDK) {
        try {
          console.log('Trying Sign in with Base...');
          
          // Initialize Base Account SDK if not already initialized
          if (!sdkInitialized) {
            initializeBaseAccount({
              appName: "BasePost's portfolio screen",
              appLogoUrl: 'https://base.org/logo.png',
            });
            setSdkInitialized(true);
          }
          
          // Perform SIWE authentication
          const { address: userAddress, signature } = await signInWithBase();

          if (userAddress) {
            console.log('Signed in with Base:', userAddress);
            setAddress(userAddress);
            localStorage.setItem('walletAddress', userAddress);
            if (signature) {
              localStorage.setItem('walletSignature', signature);
            }
            
            // Try to get user profile from Base Account SDK
            try {
              const userProfile = await getUserProfile();
              if (userProfile) {
                console.log('Got user profile:', userProfile);
                // Store profile data
                if (userProfile.pfpUrl) {
                  localStorage.setItem('userPfpUrl', userProfile.pfpUrl);
                }
                if (userProfile.displayName) {
                  localStorage.setItem('userDisplayName', userProfile.displayName);
                } else if (userProfile.username) {
                  localStorage.setItem('userDisplayName', userProfile.username);
                }
              }
              onConnect(userAddress, userProfile || undefined);
            } catch (profileError) {
              console.warn('Failed to get user profile:', profileError);
              onConnect(userAddress);
            }
            return;
          }
        } catch (baseError: any) {
          console.warn('Base Account sign-in failed, trying standard wallet:', baseError);
          // Fall through to standard wallet connection
        }
      }

      // Fallback to standard wallets
      if (!window.ethereum) {
        throw new Error('No wallet found. Please install MetaMask, Coinbase Wallet, or Base extension.');
      }

      console.log('Connecting via standard wallet...');
      
      // Request account access
      const provider = new ethers.BrowserProvider(window.ethereum);
      
      // Request accounts
      await provider.send('eth_requestAccounts', []);
      
      // Get signer and address
      const signer = await provider.getSigner();
      const userAddress = await signer.getAddress();
      
      // Switch to Base network if needed
      const network = await provider.getNetwork();
      const BASE_CHAIN_ID = BigInt(8453); // Base Mainnet
      
      if (network.chainId !== BASE_CHAIN_ID) {
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x2105' }], // Base Mainnet
          });
        } catch (switchError: any) {
          // If chain doesn't exist, add it
          if (switchError.code === 4902) {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: '0x2105',
                chainName: 'Base',
                nativeCurrency: {
                  name: 'ETH',
                  symbol: 'ETH',
                  decimals: 18,
                },
                rpcUrls: ['https://mainnet.base.org'],
                blockExplorerUrls: ['https://basescan.org'],
              }],
            });
          } else {
            throw switchError;
          }
        }
      }

      console.log('Connected wallet:', userAddress);
      
      setAddress(userAddress);
      localStorage.setItem('walletAddress', userAddress);
      
      // Try to get user profile (may not be available for standard wallets)
      try {
        const userProfile = await getUserProfile();
        onConnect(userAddress, userProfile || undefined);
      } catch (profileError) {
        // Profile not available for standard wallets - this is normal
        onConnect(userAddress);
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to connect wallet';
      setError(errorMessage);
      console.error('Wallet connection error:', err);
      
      if (errorMessage.includes('user rejected') || errorMessage.includes('User denied') || errorMessage.includes('rejected')) {
        setError('Connection rejected. Please approve the connection request.');
      } else if (errorMessage.includes('No wallet found')) {
        setError('No wallet found. Please install MetaMask, Coinbase Wallet, or Base extension.');
      } else {
        setError(`Connection failed: ${errorMessage}`);
      }
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = () => {
    setAddress(null);
    localStorage.removeItem('walletAddress');
    localStorage.removeItem('walletSignature');
    onConnect('');
  };

  if (address) {
    return (
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
          <span className="font-mono text-sm bg-white/5 px-3 py-2 rounded-lg border border-white/10">
            {address.slice(0, 6)}...{address.slice(-4)}
          </span>
        </div>
        <button
          onClick={handleDisconnect}
          className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg border border-red-500/50 transition-all duration-200 text-sm font-medium"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={handleSignIn}
        disabled={connecting || (!hasEthereum && !sdkInitialized)}
        className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {connecting ? 'Connecting...' : 'Sign in with Base'}
      </button>
      {error && (
        <div className="mt-3 bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-red-200 text-sm">
          {error}
        </div>
      )}
      {!hasEthereum && !sdkInitialized && !error && (
        <div className="mt-3 bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-3 text-yellow-200 text-sm">
          No wallet detected. Please install MetaMask, Coinbase Wallet, or Base extension.
        </div>
      )}
    </div>
  );
}
