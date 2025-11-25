import React, { useState, useEffect } from 'react';
import WalletConnect from '@/components/WalletConnect';
import UserProfile from '@/components/UserProfile';
import PortfolioCard from '@/components/PortfolioCard';
import PostList from '@/components/PostList';
import PortfolioChart from '@/components/PortfolioChart';
import { PortfolioAnalytics } from '@/lib/calcPnL';
import { AnalysisResult } from '@/lib/analyze';

export default function Home() {
  const [walletAddress, setWalletAddress] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cardImageUrl, setCardImageUrl] = useState<string | null>(null);

  useEffect(() => {
    // Wallet connection is handled in WalletConnect component
  }, []);

  const handleWalletConnect = (address: string) => {
    setWalletAddress(address);
    if (!address) {
      setAnalysis(null);
      setCardImageUrl(null);
    }
  };

  const analyzeWallet = async () => {
    if (!walletAddress) {
      setError('Please connect your wallet first');
      return;
    }

    // Set a longer timeout for the fetch request (70 seconds to account for Vercel's 60s limit)
    const controller = new AbortController();
    let timeoutId: NodeJS.Timeout | null = null;

    try {
      setLoading(true);
      setError(null);

      timeoutId = setTimeout(() => controller.abort(), 70000); // 70 seconds timeout
      
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          address: walletAddress,
          baseScanApiKey: process.env.NEXT_PUBLIC_BASESCAN_API_KEY || '',
          coinGeckoApiKey: process.env.NEXT_PUBLIC_COINGECKO_API_KEY || '',
        }),
        signal: controller.signal,
      });
      
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }

      if (!response.ok) {
        // Handle 504 Gateway Timeout specifically
        if (response.status === 504) {
          throw new Error('GATEWAY_TIMEOUT');
        }
        
        // Try to parse error as JSON, but handle HTML error pages
        let errorData;
        try {
          const text = await response.text();
          try {
            errorData = JSON.parse(text);
          } catch {
            // Response is not JSON (likely HTML error page)
            console.error('API returned non-JSON response:', text.slice(0, 200));
            throw new Error(`Analysis failed: ${response.status} ${response.statusText}. Server may be experiencing issues.`);
          }
        } catch (parseError: any) {
          if (parseError.message === 'GATEWAY_TIMEOUT' || parseError.message.includes('GATEWAY_TIMEOUT')) {
            throw parseError;
          }
          throw new Error(`Analysis failed: ${response.status} ${response.statusText}. ${parseError.message}`);
        }
        
        console.error('API Error:', errorData);
        throw new Error(errorData.error || `Analysis failed: ${response.status} ${response.statusText}`);
      }

      // Parse response as JSON, handle HTML error pages
      let result: AnalysisResult;
      try {
        const text = await response.text();
        try {
          result = JSON.parse(text);
        } catch (parseError) {
          // Response is not JSON (likely HTML error page from Vercel)
          console.error('Response is not JSON, likely HTML error page:', text.slice(0, 500));
          throw new Error('Server returned invalid response. The analysis may have timed out or the server is experiencing issues.');
        }
      } catch (parseError: any) {
        if (parseError.message.includes('timed out') || parseError.message.includes('timeout')) {
          throw new Error('GATEWAY_TIMEOUT');
        }
        throw parseError;
      }
      console.log('\n=== CLIENT: Analysis result ===');
      console.log('Total tokens:', result.wallet.tokens.length);
      console.log('Tokens with balance:', result.wallet.tokens.filter(t => parseFloat(t.balanceFormatted || '0') > 0).length);
      console.log('Posts analyzed:', result.portfolio.countOfPostTokens);
      console.log('Full result:', result);
      
      // Check if there's an error in the response
      if ((result as any).error === 'No tokens found' && (result as any).errorDetails) {
        const errorDetails = (result as any).errorDetails;
        console.error('❌ No tokens found in wallet');
        console.error('Error details:', errorDetails);
        
        const errorMessage = errorDetails.reasons?.join('\n') || 'No tokens found in wallet';
        setError(`No tokens found.\n\n${errorMessage}\n\nWallet: ${errorDetails.walletAddress}\nAPI Key: ${errorDetails.hasApiKey ? 'Present' : 'Missing'}`);
        setAnalysis(result);
        return;
      }
      
      if (result.wallet.tokens.length === 0) {
        console.error('❌ No tokens found in wallet');
        console.error('This might mean:');
        console.error('1. API rate limiting - check if you have BaseScan API key');
        console.error('2. Wallet has no tokens on Base network');
        console.error('3. API key is invalid or missing');
        console.error('4. BaseScan API may be experiencing issues');
        console.error('Check server logs for detailed API responses.');
        
        setError(`No tokens found. Possible reasons:
1. API rate limit (add NEXT_PUBLIC_BASESCAN_API_KEY to environment variables)
2. Wallet has no tokens on Base network
3. API key is invalid or missing
4. BaseScan API may be experiencing issues
5. Check server logs for detailed API responses`);
      } else {
        const tokensWithBalance = result.wallet.tokens.filter(t => parseFloat(t.balanceFormatted || '0') > 0);
        console.log(`✓ Found ${result.wallet.tokens.length} total tokens, ${tokensWithBalance.length} with balance > 0`);
        
        if (tokensWithBalance.length === 0) {
          console.warn('⚠️ Tokens found but all have zero balance');
          setError(`Found ${result.wallet.tokens.length} tokens but all have zero balance. Make sure you have tokens with non-zero balance.`);
        } else if (result.portfolio.countOfPostTokens === 0) {
          console.warn(`⚠️ Found ${tokensWithBalance.length} tokens with balance, but none are BaseApp tokens`);
          console.warn('Token details:', tokensWithBalance.slice(0, 5).map(t => ({
            symbol: t.symbol || 'Unknown',
            address: t.tokenAddress.slice(0, 10) + '...',
            balance: t.balanceFormatted
          })));
          
          // More helpful error message
          const tokenSymbols = tokensWithBalance.slice(0, 3).map(t => t.symbol || 'Unknown').join(', ');
          setError(`Found ${tokensWithBalance.length} tokens (${tokenSymbols}...) but none are BaseApp posts. 
BaseApp posts are tokens created on Base App platform. Make sure you're analyzing a wallet with BaseApp post purchases.`);
        } else {
          console.log(`✅ Successfully analyzed ${result.portfolio.countOfPostTokens} BaseApp posts`);
          setError(null); // Clear any previous errors
        }
      }
      
      setAnalysis(result);

      // Generate card image (optional - skip if fails)
      if (result.portfolio && result.portfolio.countOfPostTokens > 0) {
        try {
          await generateCard(result.portfolio);
        } catch (cardError: any) {
          // Silently skip card generation - it's optional
          console.warn('Card generation skipped (optional feature):', cardError?.message || 'Unknown error');
        }
      }
    } catch (err: any) {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      
      if (err.name === 'AbortError' || 
          err.message?.includes('timeout') || 
          err.message?.includes('Failed to fetch') || 
          err.message?.includes('ERR_CONNECTION_CLOSED') ||
          err.message === 'GATEWAY_TIMEOUT' ||
          err.message?.includes('504') ||
          err.message?.includes('Gateway Timeout')) {
        console.error('Request timeout or connection error:', err);
        setError('Request timed out (504 Gateway Timeout). The analysis is taking too long.\n\nPossible solutions:\n1. Your wallet has too many tokens - the system checks up to 50 tokens\n2. Network issues - try again in a few moments\n3. Server is overloaded - try again later\n\nTip: If your wallet has many tokens, consider using a wallet with fewer tokens for testing.');
      } else if (err.message?.includes('invalid response') || err.message?.includes('not valid JSON')) {
        console.error('Invalid response error:', err);
        setError('Server returned an invalid response. This usually means the request timed out on the server side.\n\nTry again in a few moments, or check if your wallet has too many tokens.');
      } else {
        setError(err.message || 'Failed to analyze wallet');
        console.error('Analysis error:', err);
      }
    } finally {
      setLoading(false);
    }
  };

  const generateCard = async (portfolio: PortfolioAnalytics) => {
    try {
      const response = await fetch('/api/generateCard', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          portfolio,
          walletAddress,
          username: undefined,
        }),
      });

      // Check if response is JSON (error) or blob (success)
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const errorData = await response.json();
        if (errorData.optional) {
          // Optional feature failed, skip silently
          console.log('Card generation skipped (optional feature)');
          return;
        }
        throw new Error(errorData.error || `Failed to generate card: ${response.status}`);
      }

      if (!response.ok) {
        throw new Error(`Failed to generate card: ${response.status}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setCardImageUrl(url);
    } catch (err: any) {
      // Silently skip - card generation is optional
      console.log('Card generation skipped:', err?.message || 'Unknown error');
    }
  };

  const shareCard = () => {
    if (!cardImageUrl) return;

    // Download the card image
    const link = document.createElement('a');
    link.href = cardImageUrl;
    link.download = 'portfolio-card.png';
    link.click();
  };

  return (
    <div className="min-h-screen bg-[#0d0f14] text-white">
      {/* Header with enhanced design */}
      <header className="border-b border-white/10 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 backdrop-blur-md">
        <div className="container mx-auto px-4 py-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
            BasePost's portfolio screen
          </h1>
          <p className="text-gray-300 text-lg">Portfolio Summary</p>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        {/* Wallet Section with enhanced design */}
        <div className="mb-6">
          <div className="bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-pink-500/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 shadow-xl">
            <WalletConnect onConnect={handleWalletConnect} />
            
            {walletAddress && (
              <div className="mt-4 mb-4">
                <UserProfile address={walletAddress} />
              </div>
            )}
            
            {walletAddress && (
              <button
                onClick={analyzeWallet}
                disabled={loading}
                className="mt-4 w-full bg-gradient-to-r from-blue-500 via-purple-600 to-pink-500 hover:from-blue-600 hover:via-purple-700 hover:to-pink-600 text-white font-bold py-4 px-6 rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl hover:scale-[1.02] transform"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-spin">⏳</span>
                    Analyzing...
                  </span>
                ) : (
                  'Analyze Portfolio'
                )}
              </button>
            )}
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-6 bg-red-500/20 border border-red-500/50 rounded-2xl p-4 text-red-200">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="mb-6 bg-blue-500/20 border border-blue-500/50 rounded-2xl p-4 text-blue-200 text-center">
            <p>Analyzing wallet... This may take a moment.</p>
          </div>
        )}

        {/* Analysis Results */}
        {analysis && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Stats Cards */}
            <div className="lg:col-span-1 space-y-6">
              {/* Portfolio Summary Card */}
              <div className="bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-transparent backdrop-blur-md rounded-2xl p-6 border border-white/20 shadow-xl">
                <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                  Portfolio Summary
                </h2>
                <PortfolioCard portfolio={analysis.portfolio} />
              </div>

              {/* Performance Stats */}
              {analysis.portfolio.posts.length > 0 && (
                <div className="bg-gradient-to-br from-purple-500/10 via-pink-500/10 to-transparent backdrop-blur-md rounded-2xl p-6 border border-white/20 shadow-xl">
                  <h3 className="text-xl font-bold mb-5 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                    Performance
                  </h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center bg-white/5 rounded-xl p-4 border border-white/10">
                      <span className="text-gray-300 font-medium">Profitable Posts</span>
                      <span className="px-4 py-2 bg-gradient-to-r from-green-500/30 to-emerald-500/30 text-green-300 rounded-xl font-bold border border-green-500/50 shadow-lg">
                        {analysis.portfolio.profitablePosts}
                      </span>
                    </div>
                    <div className="flex justify-between items-center bg-white/5 rounded-xl p-4 border border-white/10">
                      <span className="text-gray-300 font-medium">Losing Posts</span>
                      <span className="px-4 py-2 bg-gradient-to-r from-red-500/30 to-rose-500/30 text-red-300 rounded-xl font-bold border border-red-500/50 shadow-lg">
                        {analysis.portfolio.losingPosts}
                      </span>
                    </div>
                    <div className="flex justify-between items-center bg-white/5 rounded-xl p-4 border border-white/10">
                      <span className="text-gray-300 font-medium">Total Posts</span>
                      <span className="px-4 py-2 bg-gradient-to-r from-blue-500/30 to-cyan-500/30 text-blue-300 rounded-xl font-bold border border-blue-500/50 shadow-lg">
                        {analysis.portfolio.countOfPostTokens}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column - Chart and Posts */}
            <div className="lg:col-span-2 space-y-6">
              {/* Portfolio Chart */}
              {analysis.portfolio.posts.length > 0 && (
                <div className="bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-pink-500/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 shadow-xl">
                  <PortfolioChart portfolio={analysis.portfolio} />
                </div>
              )}

              {/* Posts List */}
              <div className="bg-gradient-to-br from-purple-500/10 via-pink-500/10 to-blue-500/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 shadow-xl">
                <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent">
                  BaseApp Posts
                </h2>
                <PostList posts={analysis.portfolio.posts} />
              </div>

              {/* Share Card */}
              {cardImageUrl && (
                <div className="bg-white/5 backdrop-blur-md rounded-2xl p-6 border border-white/10 text-center">
                  <h2 className="text-xl font-semibold mb-4">Portfolio Card</h2>
                  <img src={cardImageUrl} alt="Portfolio Card" className="max-w-full rounded-xl mb-4" />
                  <button
                    onClick={shareCard}
                    className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold py-2 px-6 rounded-xl transition-all duration-200"
                  >
                    Share Card
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
