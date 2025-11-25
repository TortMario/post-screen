# Quick Start

## Installation

```bash
npm install
```

## Environment Setup

Create a `.env.local` file:

```env
NEXT_PUBLIC_BASESCAN_API_KEY=your_api_key_here
```

You can get your API key from [Etherscan API Dashboard](https://etherscan.io/apidashboard) (optional but recommended for better rate limits).

## Run in Development Mode

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

1. **Connect wallet**: Click "Sign in with Base" and approve the connection via Base Account SDK
2. **Analyze portfolio**: Click "Analyze Portfolio" to analyze all BaseApp posts
3. **View results**: Explore analytics for each post and overall portfolio statistics
4. **Generate card**: A portfolio card image is automatically generated and can be shared

## Features

- Automatic detection of BaseApp posts from transactions
- Average purchase price calculation
- Current price retrieval from multiple sources (API, DexScreener, on-chain)
- PnL calculation for each post and portfolio
- Beautiful visualization of results

## Notes

- Canvas library is used only on the server (for image generation)
- To deploy the app, see [DEPLOY.md](./DEPLOY.md)
- Uses Base Account SDK for secure wallet connections
- Make sure you're using Base app or a compatible wallet
