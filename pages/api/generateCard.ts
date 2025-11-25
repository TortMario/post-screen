import type { NextApiRequest, NextApiResponse } from 'next';
import { CardGenerator } from '@/lib/generateCard';
import { PortfolioAnalytics } from '@/lib/calcPnL';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { portfolio, walletAddress, username } = req.body;

    if (!portfolio || !walletAddress) {
      return res.status(400).json({ error: 'Portfolio and wallet address are required' });
    }

    const generator = new CardGenerator();
    const imageBuffer = await generator.generateCard(
      portfolio as PortfolioAnalytics,
      walletAddress,
      username
    );

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', 'inline; filename="portfolio-card.png"');
    res.status(200).send(imageBuffer);
  } catch (error: any) {
    console.error('Card generation error (optional feature):', error);
    console.error('Error details:', error.message, error.stack);
    
    // Card generation is optional - return a helpful error message but don't fail hard
    const errorMessage = error.message?.includes('Canvas') || error.message?.includes('canvas')
      ? 'Canvas library not available. Image generation requires canvas dependencies. This feature is optional.'
      : error.message || 'Card generation failed (optional feature)';
    
    // Return 200 with error message instead of 500 to not break the flow
    res.status(200).json({ 
      error: errorMessage,
      optional: true 
    });
  }
}

