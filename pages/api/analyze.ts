import type { NextApiRequest, NextApiResponse } from 'next';
import { AnalyticsService } from '@/lib/analyze';

// Configure max duration for Vercel (60 seconds)
export const config = {
  maxDuration: 60,
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Set a longer timeout for the response
  res.setHeader('Connection', 'keep-alive');
  
  try {
    const { address, baseScanApiKey, coinGeckoApiKey } = req.body;

    console.log('=== API Analyze Request ===');
    console.log('Address:', address);
    console.log('Has BaseScan API key (from body):', !!baseScanApiKey);
    console.log('BaseScan API key from body (first 10 chars):', baseScanApiKey ? baseScanApiKey.slice(0, 10) + '...' : 'N/A');
    console.log('Has CoinGecko API key (from body):', !!coinGeckoApiKey);
    
    // Also check env variables (on server, NEXT_PUBLIC_ vars are available)
    const envBaseScanKey = process.env.NEXT_PUBLIC_BASESCAN_API_KEY;
    const envCoinGeckoKey = process.env.NEXT_PUBLIC_COINGECKO_API_KEY;
    
    console.log('Has BaseScan API key (from env):', !!envBaseScanKey);
    console.log('BaseScan API key from env (first 10 chars):', envBaseScanKey ? envBaseScanKey.slice(0, 10) + '...' : 'N/A');
    console.log('Has CoinGecko API key (from env):', !!envCoinGeckoKey);
    
    // Use provided keys or env keys (prefer body, fallback to env)
    const finalBaseScanKey = baseScanApiKey || envBaseScanKey || '';
    const finalCoinGeckoKey = coinGeckoApiKey || envCoinGeckoKey || '';
    
    console.log('=== Final API Keys ===');
    console.log('Using BaseScan API key:', !!finalBaseScanKey, '(length:', finalBaseScanKey.length, ')');
    console.log('BaseScan API key source:', baseScanApiKey ? 'body' : (envBaseScanKey ? 'env' : 'none'));
    console.log('Using CoinGecko API key:', !!finalCoinGeckoKey);
    
    if (!finalBaseScanKey) {
      console.error('⚠️ WARNING: No BaseScan API key available!');
      console.error('This will cause rate limiting and may prevent token fetching.');
    }

    if (!address) {
      return res.status(400).json({ error: 'Wallet address is required' });
    }

    // Validate address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return res.status(400).json({ error: 'Invalid wallet address format' });
    }

    const analyticsService = new AnalyticsService(finalBaseScanKey, finalCoinGeckoKey);
    const result = await analyticsService.analyzeWallet(address);

    console.log('\n=== ANALYSIS COMPLETE ===');
    console.log('Total tokens found:', result.wallet.tokens.length);
    console.log('Tokens with balance > 0:', result.wallet.tokens.filter(t => parseFloat(t.balanceFormatted) > 0).length);
    console.log('Posts analyzed:', result.portfolio.countOfPostTokens);
    console.log('Total PnL:', result.portfolio.totalPnLPct.toFixed(2) + '%');
    
    if (result.wallet.tokens.length === 0) {
      console.error('⚠️ WARNING: No tokens found!');
      console.error('This could mean:');
      console.error('1. API rate limit (add NEXT_PUBLIC_BASESCAN_API_KEY to .env.local)');
      console.error('2. Wallet has no tokens on Base network');
      console.error('3. API key is invalid or expired');
      console.error('4. Network connection issues');
      console.error('5. BaseScan API V2 may be having issues');
      
      // Return a more helpful error response
      return res.status(200).json({
        ...result,
        error: 'No tokens found',
        errorDetails: {
          message: 'No tokens were found in the wallet. This could be due to:',
          reasons: [
            'API rate limit - add NEXT_PUBLIC_BASESCAN_API_KEY to environment variables',
            'Wallet has no tokens on Base network',
            'API key is invalid or expired',
            'Network connection issues',
            'BaseScan API may be experiencing issues'
          ],
          hasApiKey: !!finalBaseScanKey,
          walletAddress: address
        }
      });
    } else if (result.wallet.tokens.length > 0) {
      console.log('Sample tokens:', result.wallet.tokens.slice(0, 5).map(t => ({
        symbol: t.symbol,
        name: t.name,
        address: t.tokenAddress.slice(0, 10) + '...',
        balance: t.balanceFormatted
      })));
    }
    console.log('========================\n');

    res.status(200).json(result);
  } catch (error: any) {
    console.error('Analysis error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      error: error.message || 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

