import React, { useState, useEffect } from 'react';
import WalletConnect from '@/components/WalletConnect';
import PortfolioCard from '@/components/PortfolioCard';
import PostList from '@/components/PostList';
import PortfolioChart from '@/components/PortfolioChart';
import { PortfolioAnalytics, AnalysisResult } from '@/lib/calcPnL';

export default function Home() {
  const [walletAddress, setWalletAddress] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cardImageUrl, setCardImageUrl] = useState<string | null>(null);

  useEffect(() => {
    // Base Account SDK initialization is handled in WalletConnect component
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

    try {
      setLoading(true);
      setError(null);

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
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('API Error:', errorData);
        throw new Error(errorData.error || `Analysis failed: ${response.status} ${response.statusText}`);
      }

      const result: AnalysisResult = await response.json();
      console.log('\n=== CLIENT: Analysis result ===');
      console.log('Total tokens:', result.wallet.tokens.length);
      console.log('Tokens with balance:', result.wallet.tokens.filter(t => parseFloat(t.balanceFormatted || '0') > 0).length);
      console.log('Posts analyzed:', result.portfolio.countOfPostTokens);
      console.log('Full result:', result);
      
      if (result.wallet.tokens.length === 0) {
        console.error('❌ No tokens found in wallet');
        console.error('This means the API returned 0 tokens. Check server logs for API responses.');
        setError('No tokens found. Check browser console and server logs for details.');
      } else {
        const tokensWithBalance = result.wallet.tokens.filter(t => parseFloat(t.balanceFormatted || '0') > 0);
        console.log(`✓ Found ${result.wallet.tokens.length} total tokens, ${tokensWithBalance.length} with balance > 0`);
        
        if (tokensWithBalance.length === 0) {
          console.warn('⚠️ Tokens found but all have zero balance');
          setError(`Found ${result.wallet.tokens.length} tokens but all have zero balance.`);
        } else if (result.portfolio.countOfPostTokens === 0) {
          console.warn(`⚠️ Found ${tokensWithBalance.length} tokens with balance, but none are BaseApp tokens or couldn't be analyzed`);
          console.warn('Token details:', tokensWithBalance.slice(0, 5).map(t => ({
            symbol: t.symbol,
            address: t.tokenAddress.slice(0, 10) + '...',
            balance: t.balanceFormatted
          })));
          setError(`Found ${tokensWithBalance.length} tokens but couldn't analyze them as BaseApp posts. Check server logs for details.`);
        } else {
          console.log(`✅ Successfully analyzed ${result.portfolio.countOfPostTokens} BaseApp posts`);
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
      setError(err.message || 'Failed to analyze wallet');
      console.error('Analysis error:', err);
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
