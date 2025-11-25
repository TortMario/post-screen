import React, { useState } from 'react';
import { payWithBase, getPaymentStatus, isBasePayAvailable } from '@/lib/baseAccount';

interface BasePayButtonProps {
  amount: string; // USD amount
  to: string; // Recipient address
  testnet?: boolean;
  onSuccess?: (paymentId: string, status: string) => void;
  onError?: (error: string) => void;
  className?: string;
  disabled?: boolean;
}

/**
 * Base Pay Button Component
 * One-tap USDC payment using Base Account SDK
 */
export default function BasePayButton({
  amount,
  to,
  testnet = false,
  onSuccess,
  onError,
  className = '',
  disabled = false,
}: BasePayButtonProps) {
  const [processing, setProcessing] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const handlePay = async () => {
    if (!isBasePayAvailable()) {
      const errorMsg = 'Base Pay is not available. Make sure Base Account SDK is loaded.';
      setStatus(errorMsg);
      onError?.(errorMsg);
      return;
    }

    try {
      setProcessing(true);
      setStatus('Processing payment...');

      // Initiate payment
      const result = await payWithBase({
        amount,
        to,
        testnet,
      });

      // Check payment status
      const paymentStatus = await getPaymentStatus({
        id: result.id,
        testnet,
      });

      setStatus(`Payment ${paymentStatus.status}`);
      onSuccess?.(result.id, paymentStatus.status);
    } catch (error: any) {
      const errorMsg = error.message || 'Payment failed';
      setStatus(`Error: ${errorMsg}`);
      onError?.(errorMsg);
      console.error('Base Pay error:', error);
    } finally {
      setProcessing(false);
    }
  };

  const defaultClassName =
    'w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <div>
      <button
        onClick={handlePay}
        disabled={processing || disabled || !isBasePayAvailable()}
        className={className || defaultClassName}
      >
        {processing ? 'Processing...' : `Pay ${amount} USDC with Base`}
      </button>
      {status && (
        <div
          className={`mt-3 rounded-lg p-3 text-sm ${
            status.includes('Error')
              ? 'bg-red-500/20 border border-red-500/50 text-red-200'
              : status.includes('completed')
              ? 'bg-green-500/20 border border-green-500/50 text-green-200'
              : 'bg-blue-500/20 border border-blue-500/50 text-blue-200'
          }`}
        >
          {status}
        </div>
      )}
      {!isBasePayAvailable() && !status && (
        <div className="mt-3 bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-3 text-yellow-200 text-sm">
          Base Pay is not available. Make sure you're signed in with Base.
        </div>
      )}
    </div>
  );
}

