# Base Account SDK Integration Guide

This document describes the Base Account SDK integration in the BasePost's portfolio screen project.

## ✅ What's Integrated

### 1. Base Account SDK Loading
- SDK is loaded via CDN in `pages/_document.tsx`
- Also available via NPM package `@base-org/account` (already installed)

### 2. SDK Utilities
- `lib/baseAccount.ts` - core functions for working with Base Account SDK
  - `initializeBaseAccount()` - SDK initialization
  - `signInWithBase()` - Sign in with Base
  - `payWithBase()` - Base Pay for one-tap payments
  - `getPaymentStatus()` - get payment status

### 3. Components
- `components/WalletConnect.tsx` - updated to use Sign in with Base
- `components/BasePayButton.tsx` - new component for Base Pay (optional)

### 4. TypeScript Types
- `types/window.d.ts` - updated with types for `window.base` and `window.createBaseAccountSDK`

## 🚀 How to Use

### Sign in with Base

The `WalletConnect` component automatically uses Base Account SDK:

```tsx
import WalletConnect from '@/components/WalletConnect';

<WalletConnect onConnect={(address) => {
  console.log('Connected:', address);
}} />
```

### Using Base Pay (Optional)

If you need payment functionality:

```tsx
import BasePayButton from '@/components/BasePayButton';

<BasePayButton
  amount="5.00"
  to="0x2211d1D0020DAEA8039E46Cf1367962070d77DA9"
  testnet={false}
  onSuccess={(id, status) => {
    console.log('Payment successful!', id, status);
  }}
  onError={(error) => {
    console.error('Payment failed:', error);
  }}
/>
```

### Programmatic Usage

```typescript
import {
  initializeBaseAccount,
  signInWithBase,
  payWithBase,
  getPaymentStatus,
} from '@/lib/baseAccount';

// SDK initialization
useEffect(() => {
  initializeBaseAccount({
    appName: "BasePost's portfolio screen",
    appLogoUrl: 'https://your-logo-url.com/logo.png',
  });
}, []);

// Sign in
const handleSignIn = async () => {
  try {
    const { address, message, signature } = await signInWithBase();
    console.log('Signed in:', address);
    // Send message and signature to backend for verification
  } catch (error) {
    console.error('Sign in failed:', error);
  }
};

// Payment
const handlePayment = async () => {
  try {
    const result = await payWithBase({
      amount: '10.00',
      to: '0x...',
      testnet: false,
    });
    
    const status = await getPaymentStatus({
      id: result.id,
      testnet: false,
    });
    
    console.log('Payment status:', status);
  } catch (error) {
    console.error('Payment failed:', error);
  }
};
```

## 🔧 Configuration

### Changing Application Configuration

Modify settings in `components/WalletConnect.tsx`:

```typescript
initializeBaseAccount({
  appName: 'Your Application Name',
  appLogoUrl: 'https://your-logo-url.com/logo.png',
});
```

### Changing Network

By default, Base Mainnet (chainId: 8453) is used. To change:

In `lib/baseAccount.ts`:

```typescript
chainId: '0x2105', // Base Mainnet - 8453
// or
chainId: '0x14a34', // Base Sepolia - 84532
```

## 📚 Documentation

- [Base Account SDK Quick Start](https://docs.base.org/base-account/quickstart/web)
- [Base Account SDK Reference](https://docs.base.org/base-account/reference)
- [Sign in with Base Button](https://docs.base.org/base-account/reference/ui-elements/sign-in-with-base-button)
- [Base Pay Button](https://docs.base.org/base-account/reference/ui-elements/base-pay-button)

## 🔄 Migration from Coinbase Wallet SDK

If you're migrating from Coinbase Wallet SDK, simply replace imports:

**Before:**
```typescript
import CoinbaseWalletSDK from '@coinbase/wallet-sdk';
```

**After:**
```typescript
import { initializeBaseAccount } from '@/lib/baseAccount';
```

## 🐛 Troubleshooting

### SDK Not Loading

1. Check that the script is loading in `_document.tsx`
2. Check CSP settings - should allow `https://unpkg.com`
3. Check browser console for errors

### Sign in Not Working

1. Make sure SDK is initialized before use
2. Check that user is using Base app or extension
3. Check console for errors

### Base Pay Not Available

Base Pay is only available after Sign in with Base. Make sure user is authenticated first.

## 📝 Notes

- Base Account SDK works with both CDN and NPM package
- Sign in with Base requires backend verification (SIWE)
- Base Pay works only with USDC on Base network
- Testnet mode can be enabled via `testnet: true` parameter
