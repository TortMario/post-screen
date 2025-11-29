'use client';

import { useState, useEffect } from 'react';
import { initializeBaseAccount, signInWithBase, getUserProfile } from '@/lib/baseAccount';
import { getMiniAppUserProfile, isInMiniApp } from '@/lib/miniapp';
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
  const [manualAddress, setManualAddress] = useState<string>('');
  const [useManualAddress, setUseManualAddress] = useState(false);

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

      // Check if we're in a Mini App and get user profile
      (async () => {
        try {
          const inMiniApp = await isInMiniApp();
          if (inMiniApp) {
            console.log('✅ App is running as Mini App');
            const userProfile = await getMiniAppUserProfile();
            if (userProfile) {
              console.log('✅ Got user profile from Mini App:', userProfile);
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
          }
        } catch (err) {
          console.warn('Failed to check Mini App status:', err);
        }
      })();
    }

    // Check for saved address - но не устанавливаем его автоматически
    // Пользователь должен явно выбрать режим
    // const savedAddress = localStorage.getItem('walletAddress');
    // if (savedAddress) {
    //   setAddress(savedAddress);
    //   onConnect(savedAddress);
    // }
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
            
            // Try to get user profile (from Mini App SDK or Base Account SDK)
            try {
              // First try Mini App SDK (for Mini Apps)
              let userProfile = await getMiniAppUserProfile();
              
              // Fallback to Base Account SDK
              if (!userProfile) {
                userProfile = await getUserProfile();
              }
              
              if (userProfile) {
                console.log('✅ Got user profile:', userProfile);
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
        // First try Mini App SDK (for Mini Apps)
        let userProfile = await getMiniAppUserProfile();
        
        // Fallback to Base Account SDK
        if (!userProfile) {
          userProfile = await getUserProfile();
        }
        
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
    setManualAddress('');
    setUseManualAddress(false);
    localStorage.removeItem('walletAddress');
    localStorage.removeItem('walletSignature');
    onConnect('');
  };

  const handleManualAddressSubmit = () => {
    // Очищаем адрес от лишних символов и пробелов
    let cleanedAddress = manualAddress.trim().replace(/\s+/g, '');
    
    // Если адрес содержит несколько адресов подряд (дублирование), берем первый
    const addressMatch = cleanedAddress.match(/0x[a-fA-F0-9]{40}/);
    if (addressMatch) {
      cleanedAddress = addressMatch[0];
    }
    
    // Validate address format
    if (!cleanedAddress) {
      setError('Please enter a wallet address');
      return;
    }
    
    // Проверяем формат адреса (должен быть 0x + 40 hex символов)
    if (!/^0x[a-fA-F0-9]{40}$/i.test(cleanedAddress)) {
      setError(`Invalid wallet address format. Please enter a valid Ethereum address (0x...). Got: ${cleanedAddress.slice(0, 20)}... (length: ${cleanedAddress.length})`);
      return;
    }
    
    setError(null);
    setAddress(cleanedAddress.toLowerCase()); // Нормализуем к lowercase
    localStorage.setItem('walletAddress', cleanedAddress.toLowerCase());
    setManualAddress(''); // Очищаем поле ввода
    onConnect(cleanedAddress.toLowerCase());
  };

  // Показываем подключенный адрес, но также даем возможность ввести новый
  if (address && !useManualAddress) {
    return (
      <div className="space-y-4">
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
        <div className="flex gap-2">
          <button
            onClick={() => setUseManualAddress(true)}
            className="flex-1 py-2 px-4 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg border border-white/10 transition-all duration-200 text-sm font-medium"
          >
            Enter Another Address
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toggle between wallet connect and manual input */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setUseManualAddress(false)}
          className={`flex-1 py-2 px-4 rounded-lg transition-all duration-200 text-sm font-medium ${
            !useManualAddress
              ? 'bg-blue-500/30 text-blue-300 border border-blue-500/50'
              : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
          }`}
        >
          Connect Wallet
        </button>
        <button
          onClick={() => setUseManualAddress(true)}
          className={`flex-1 py-2 px-4 rounded-lg transition-all duration-200 text-sm font-medium ${
            useManualAddress
              ? 'bg-blue-500/30 text-blue-300 border border-blue-500/50'
              : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
          }`}
        >
          Enter Address
        </button>
      </div>

      {!useManualAddress ? (
        // Wallet Connect Mode
        <>
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
        </>
      ) : (
        // Manual Address Input Mode
        <div className="space-y-3">
          {address && (
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 text-blue-200 text-sm">
              Current address: {address.slice(0, 6)}...{address.slice(-4)}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Wallet Address
            </label>
            <input
              type="text"
              value={manualAddress}
              onChange={(e) => {
                let value = e.target.value;
                // Удаляем все пробелы и переносы строк
                value = value.replace(/\s+/g, '').replace(/\n/g, '');
                // Если найдено несколько адресов, берем первый
                const addressMatch = value.match(/0x[a-fA-F0-9]{40}/i);
                if (addressMatch) {
                  value = addressMatch[0];
                }
                setManualAddress(value);
                setError(null);
              }}
              onPaste={(e) => {
                e.preventDefault();
                // Получаем вставленный текст
                const pastedText = e.clipboardData.getData('text');
                // Очищаем от пробелов и переносов
                let cleaned = pastedText.trim().replace(/\s+/g, '').replace(/\n/g, '');
                // Ищем адрес в вставленном тексте
                const addressMatch = cleaned.match(/0x[a-fA-F0-9]{40}/i);
                if (addressMatch) {
                  cleaned = addressMatch[0];
                }
                setManualAddress(cleaned);
                setError(null);
              }}
              placeholder="0x..."
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleManualAddressSubmit();
                }
              }}
              autoFocus={useManualAddress}
            />
          </div>
          <button
            onClick={handleManualAddressSubmit}
            className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200"
          >
            Analyze Portfolio
          </button>
          {error && (
            <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-red-200 text-sm">
              {error}
            </div>
          )}
          <div className="text-xs text-gray-400 text-center">
            Enter any Base network wallet address to analyze its portfolio
          </div>
          {address && (
            <button
              onClick={() => {
                setUseManualAddress(false);
                setManualAddress('');
              }}
              className="w-full py-2 px-4 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg border border-white/10 transition-all duration-200 text-sm font-medium"
            >
              Cancel
            </button>
          )}
        </div>
      )}
    </div>
  );
}
