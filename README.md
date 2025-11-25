# BaseApp Post Analytics

A web application for analyzing investments in BaseApp posts. The app connects to the user's wallet, finds all BaseApp post purchases, calculates average purchase price, retrieves current price, and computes PnL (Profit/Loss).

## 🚀 Features

- ✅ **Sign in with Base** - Base Account SDK integration for secure connection
- ✅ Base wallet (EVM) connection via Base Account SDK
- ✅ Automatic detection of BaseApp posts from transactions
- ✅ Average purchase price calculation for each post
- ✅ Current price retrieval via API (BaseApp API, DexScreener, on-chain fallback)
- ✅ PnL calculation for each post and portfolio
- ✅ Beautiful portfolio card image generation
- ✅ Analytics for each post + overall portfolio dynamics
- ✅ **Base Pay** - ready-to-use component for one-tap USDC payments (optional)

## 📦 Installation

```bash
npm install
```

**Note**: Image generation (portfolio card) requires the `canvas` library, which is optional. The app works without it - card generation will simply be disabled.

To enable card generation locally, install canvas as an optional dependency:

```bash
# macOS - first install native dependencies via Homebrew:
brew install pkg-config cairo pango libpng jpeg giflib librsvg
# Then install canvas:
npm install canvas

# Linux (Ubuntu/Debian):
sudo apt-get install build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev
npm install canvas
```

**On Vercel**: Canvas is not available due to native dependency requirements. Card generation is automatically disabled in production.

## 🔧 Configuration

1. Create a `.env.local` file in the project root:

```env
NEXT_PUBLIC_BASESCAN_API_KEY=your_etherscan_api_key_here
NEXT_PUBLIC_COINGECKO_API_KEY=your_coingecko_api_key_here
```

**Important**: As of August 15, 2025, BaseScan API V1 is deprecated. Etherscan API V2 is used, which works for all networks including Base.

Get API keys:
- **Etherscan API**: [Etherscan API Dashboard](https://etherscan.io/apidashboard) - one key works for all networks (Base chainid=8453)
- **CoinGecko API**: [CoinGecko API](https://www.coingecko.com/en/api) - used for ETH/USD prices and token prices

## 🏃 Running

```bash
npm run dev
```

The application will be available at `http://localhost:3000`

## 🔌 Base Account SDK Integration

The project is integrated with **Base Account SDK** for secure wallet connection and Base Pay functionality.

### What's integrated:

1. **Sign in with Base** - `WalletConnect.tsx` component uses Base Account SDK for connection
2. **Base Account Utilities** - utilities in `lib/baseAccount.ts` for working with SDK
3. **Base Pay Component** - ready-to-use `BasePayButton.tsx` component for one-tap payments
4. **CDN SDK loading** - Base Account SDK is loaded via CDN in `_document.tsx`

### Using Base Account SDK:

```typescript
import { initializeBaseAccount, signInWithBase } from '@/lib/baseAccount';

// Initialization (usually in component)
initializeBaseAccount({
  appName: "BasePost's portfolio screen",
  appLogoUrl: 'https://your-logo-url.com/logo.png',
});

// Connect wallet
const { address, message, signature } = await signInWithBase();
```

### Base Pay:

```tsx
import BasePayButton from '@/components/BasePayButton';

<BasePayButton
  amount="5.00"
  to="0x2211d1D0020DAEA8039E46Cf1367962070d77DA9"
  testnet={false}
  onSuccess={(id, status) => console.log('Payment successful', id, status)}
  onError={(error) => console.error('Payment failed', error)}
/>
```

More information: [Base Account SDK Documentation](https://docs.base.org/base-account/quickstart/web)

## 🏗️ Project Structure

```
├── components/          # React components
│   ├── WalletConnect.tsx     # Sign in with Base component
│   ├── BasePayButton.tsx     # Base Pay component
│   ├── PortfolioCard.tsx
│   └── PostList.tsx
├── lib/                # Core logic
│   ├── baseAccount.ts        # Base Account SDK utilities
│   ├── wallet.ts             # Wallet connection and data retrieval
│   ├── detectBaseAppPost.ts  # BaseApp post detector
│   ├── getPostPrice.ts       # Price retrieval
│   ├── calcPnL.ts            # PnL calculation
│   ├── analyze.ts            # Analytics aggregation
│   └── generateCard.ts       # Card image generation
├── pages/
│   ├── api/
│   │   ├── analyze.ts        # Analysis API
│   │   └── generateCard.ts   # Card generation API
│   ├── index.tsx             # Main page
│   ├── _app.tsx
│   └── _document.tsx         # Base Account SDK loading
├── types/
│   └── window.d.ts           # TypeScript types for window.base
└── styles/
    └── globals.css           # Styles
```

## 🔍 How BaseApp Post Detector Works

### Accurate detection by bytecode (100% accuracy)

All BaseApp tokens use **EIP-1167 Minimal Proxy** with identical runtime bytecode:

```
0x363d3d373d3d3d363d737cad62748ddf516cf85bc2c05c14786d84cf861c5af43d82803e903d91602b57fd5bf3
```

The detector checks each token's bytecode and compares it with this fingerprint. This is the most accurate method for identifying BaseApp tokens.

### Alternative methods (used as fallback)

1. **handleOps function** - standard function for BaseApp operations
2. **Patterns in callData**: `tba-social`, `mypinata`, `baseapp`
3. **Long input data** (sign of paymaster usage)

## 💰 Price Sources

The application attempts to get prices in the following order:

1. **DexScreener** - `https://api.dexscreener.com/latest/dex/tokens/{tokenAddress}` (primary source for BaseApp tokens)
2. **CoinGecko** - `https://api.coingecko.com/api/v3/simple/token_price/base` (by contract address on Base)
3. **BaseApp API** - `https://api.baseapp.xyz/v1/post/{postId}` (fallback)
4. **On-chain bonding curve** - reading price directly from contract (last fallback)

**ETH/USD rate** is retrieved via CoinGecko API.

## 📊 PnL Calculation

For each post, the following is calculated:

- `averageBuyPrice` = totalCost / totalAmountBought
- `currentValue` = balance × currentPrice
- `initialValue` = balance × averageBuyPrice
- `pnl` = currentValue - initialValue
- `pnlPct` = (pnl / initialValue) × 100

## 🖼️ Image Generation

The image is generated using Canvas and includes:

- Wallet information
- Portfolio summary (total PnL, investments, current value)
- List of posts with detailed information
- Visual profit/loss indicators

## 🚀 Deployment

Deployment instructions for Vercel via GitHub: [DEPLOY.md](./DEPLOY.md)

## 🔐 Security

- All wallet operations are performed on the client side
- API keys are stored in environment variables
- Transactions are analyzed for reading only

## 📝 License

MIT
