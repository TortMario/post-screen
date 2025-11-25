import React, { useState, useEffect } from 'react';
import { signInWithBase, initializeBaseAccount } from '@/lib/baseAccount';

interface WalletConnectProps {
  onConnect: (address: string) => void;
}

export default function WalletConnect({ onConnect }: WalletConnectProps) {
  const [address, setAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sdkInitialized, setSdkInitialized] = useState(false);

  useEffect(() => {
    // Initialize Base Account SDK on mount
    if (typeof window !== 'undefined' && !sdkInitialized) {
      try {
        initializeBaseAccount({
          appName: "BasePost's portfolio screen",
          appLogoUrl: 'https://base.org/logo.png', // You can replace with your app logo
        });
        setSdkInitialized(true);
        console.log('Base Account SDK initialized');
      } catch (err) {
        console.error('Failed to initialize Base Account SDK:', err);
        setError('Failed to initialize Base Account SDK. Make sure the SDK script is loaded.');
      }
    }

    // Check for saved address
    const savedAddress = localStorage.getItem('walletAddress');
    if (savedAddress) {
      setAddress(savedAddress);
      onConnect(savedAddress);
    }
  }, [onConnect, sdkInitialized]);

  const connectWallet = async () => {
    try {
      setConnecting(true);
      setError(null);

      if (!sdkInitialized) {
        throw new Error('Base Account SDK not initialized. Please refresh the page.');
      }

      console.log('Signing in with Base...');

      // Sign in with Base using wallet_connect method
      const { address: userAddress, message, signature } = await signInWithBase();

      console.log('Successfully signed in with Base:', userAddress);
      console.log('Authentication data:', { address: userAddress, message, signature });

      // In a real app, you would send the message and signature to your backend for verification
      // For now, we'll just store the address
      setAddress(userAddress);
      localStorage.setItem('walletAddress', userAddress);
      localStorage.setItem('walletSignature', signature); // Store signature for potential backend verification
      onConnect(userAddress);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to sign in with Base';
      setError(errorMessage);
      console.error('Sign-in error:', err);
      
      if (errorMessage.includes('user rejected') || errorMessage.includes('User denied') || errorMessage.includes('rejected')) {
        setError('Connection rejected. Please approve the connection request.');
      } else if (errorMessage.includes('not initialized')) {
        setError('Base Account SDK not initialized. Please refresh the page.');
      } else {
        setError(`Sign-in failed: ${errorMessage}`);
      }
    } finally {
      setConnecting(false);
    }
  };

  const disconnect = () => {
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
          onClick={disconnect}
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
        onClick={connectWallet}
        disabled={connecting || !sdkInitialized}
        className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {connecting ? 'Connecting to Base...' : 'Sign in with Base'}
      </button>
      {error && (
        <div className="mt-3 bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-red-200 text-sm">
          {error}
        </div>
      )}
      {!sdkInitialized && !error && (
        <div className="mt-3 bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-3 text-yellow-200 text-sm">
          Initializing Base Account SDK...
        </div>
      )}
    </div>
  );
}
