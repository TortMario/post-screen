// Canvas import - will be loaded dynamically on server side
let createCanvas: any = null;
if (typeof window === 'undefined') {
  try {
    const canvas = require('canvas');
    createCanvas = canvas.createCanvas;
  } catch (e) {
    // Canvas not available - will throw error when used
    console.warn('Canvas not available, image generation will fail');
  }
}
import { PortfolioAnalytics, PostAnalytics } from './calcPnL';

interface CardOptions {
  width?: number;
  height?: number;
  backgroundColor?: string;
}

export class CardGenerator {
  private width: number;
  private height: number;
  private backgroundColor: string;

  constructor(options: CardOptions = {}) {
    this.width = options.width || 1200;
    this.height = options.height || 1600;
    this.backgroundColor = options.backgroundColor || '#FFFFFF';
  }

  async generateCard(
    portfolio: PortfolioAnalytics,
    walletAddress: string,
    username?: string
  ): Promise<Buffer> {
    if (!createCanvas) {
      throw new Error('Canvas library not available. Please install canvas dependencies.');
    }
    
    const canvas = createCanvas(this.width, this.height);
    const ctx = canvas.getContext('2d');

    // Draw background gradient
    this.drawGradientBackground(ctx);

    // Draw header
    this.drawHeader(ctx, username || 'BaseApp User', walletAddress);

    // Draw portfolio summary
    this.drawPortfolioSummary(ctx, portfolio, 60, 200);

    // Draw posts list
    this.drawPostsList(ctx, portfolio.posts, 60, 500);

    // Draw footer
    this.drawFooter(ctx);

    return canvas.toBuffer('image/png');
  }

  private drawGradientBackground(ctx: CanvasRenderingContext2D) {
    const gradient = ctx.createLinearGradient(0, 0, this.width, this.height);
    gradient.addColorStop(0, '#F8F9FA');
    gradient.addColorStop(1, '#E9ECEF');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.width, this.height);
  }

  private drawHeader(
    ctx: CanvasRenderingContext2D,
    username: string,
    walletAddress: string
  ) {
    // Title
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText("BasePost's portfolio screen", this.width / 2, 60);

    // Username
    ctx.fillStyle = '#666666';
    ctx.font = '32px Arial';
    ctx.fillText(username, this.width / 2, 100);

    // Wallet address
    ctx.fillStyle = '#999999';
    ctx.font = '20px monospace';
    const shortAddress = `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
    ctx.fillText(shortAddress, this.width / 2, 130);
  }

  private drawPortfolioSummary(
    ctx: CanvasRenderingContext2D,
    portfolio: PortfolioAnalytics,
    x: number,
    y: number
  ) {
    const cardWidth = this.width - 120;
    const cardHeight = 250;

    // Draw card background with neumorphism effect
    this.drawNeumorphicCard(ctx, x, y, cardWidth, cardHeight);

    // Portfolio stats
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 36px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('Portfolio Summary', x + 30, y + 50);

    // Total invested
    ctx.fillStyle = '#666666';
    ctx.font = '24px Arial';
    ctx.fillText('Total Invested:', x + 30, y + 100);
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 28px Arial';
    ctx.fillText(`$${parseFloat(portfolio.totalInvested).toFixed(2)}`, x + 250, y + 100);

    // Current value
    ctx.fillStyle = '#666666';
    ctx.font = '24px Arial';
    ctx.fillText('Current Value:', x + 30, y + 140);
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 28px Arial';
    ctx.fillText(`$${parseFloat(portfolio.totalCurrentValue).toFixed(2)}`, x + 250, y + 140);

    // Total PnL
    ctx.fillStyle = '#666666';
    ctx.font = '24px Arial';
    ctx.fillText('Total PnL:', x + 30, y + 180);
    const pnlColor = parseFloat(portfolio.totalPnL) >= 0 ? '#00C853' : '#FF1744';
    ctx.fillStyle = pnlColor;
    ctx.font = 'bold 28px Arial';
    const pnlSign = parseFloat(portfolio.totalPnL) >= 0 ? '+' : '';
    ctx.fillText(
      `${pnlSign}$${parseFloat(portfolio.totalPnL).toFixed(2)} (${pnlSign}${portfolio.totalPnLPct.toFixed(2)}%)`,
      x + 250,
      y + 180
    );

    // Posts count
    ctx.fillStyle = '#666666';
    ctx.font = '20px Arial';
    ctx.fillText(
      `${portfolio.countOfPostTokens} posts • ${portfolio.profitablePosts} profitable • ${portfolio.losingPosts} losing`,
      x + 30,
      y + 220
    );
  }

  private drawPostsList(
    ctx: CanvasRenderingContext2D,
    posts: PostAnalytics[],
    x: number,
    y: number
  ) {
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 36px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('Post Tokens', x, y);

    const startY = y + 50;
    const cardHeight = 120;
    const spacing = 20;

    // Show up to 8 posts (to fit on card)
    const postsToShow = posts.slice(0, 8);

    for (let i = 0; i < postsToShow.length; i++) {
      const post = postsToShow[i];
      const cardY = startY + i * (cardHeight + spacing);

      this.drawPostCard(ctx, post, x, cardY, this.width - 120, cardHeight);
    }
  }

  private drawPostCard(
    ctx: CanvasRenderingContext2D,
    post: PostAnalytics,
    x: number,
    y: number,
    width: number,
    height: number
  ) {
    // Draw card background
    this.drawNeumorphicCard(ctx, x, y, width, height);

    const padding = 20;

    // Post name/address
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'left';
    const postName = post.postName || `${post.postTokenAddress.slice(0, 8)}...`;
    ctx.fillText(postName, x + padding, y + 35);

    // Balance
    ctx.fillStyle = '#666666';
    ctx.font = '18px Arial';
    ctx.fillText(`Balance: ${parseFloat(post.balanceFormatted).toFixed(4)}`, x + padding, y + 60);

    // Price info
    ctx.fillText(
      `Avg Buy: $${parseFloat(post.averageBuyPrice).toFixed(6)}`,
      x + padding,
      y + 85
    );
    ctx.fillText(
      `Current: $${parseFloat(post.currentPrice).toFixed(6)}`,
      x + padding + 250,
      y + 85
    );

    // PnL
    const pnlColor = post.pnlPct >= 0 ? '#00C853' : '#FF1744';
    ctx.fillStyle = pnlColor;
    ctx.font = 'bold 22px Arial';
    const pnlSign = post.pnlPct >= 0 ? '+' : '';
    ctx.fillText(
      `${pnlSign}${post.pnlPct.toFixed(2)}% (${pnlSign}$${parseFloat(post.pnl).toFixed(2)})`,
      x + width - padding - 300,
      y + 60
    );

    // PnL bar
    const barWidth = 200;
    const barHeight = 8;
    const barX = x + width - padding - barWidth;
    const barY = y + 90;

    // Background bar
    ctx.fillStyle = '#E0E0E0';
    ctx.fillRect(barX, barY, barWidth, barHeight);

    // PnL bar (green/red)
    ctx.fillStyle = pnlColor;
    const barFill = Math.min(Math.abs(post.pnlPct) / 100, 1); // Cap at 100%
    ctx.fillRect(barX, barY, barWidth * barFill, barHeight);
  }

  private drawNeumorphicCard(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number
  ) {
    const radius = 20;

    // Shadow (light)
    ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = -5;
    ctx.shadowOffsetY = -5;

    // Card background
    ctx.fillStyle = '#FFFFFF';
    this.roundRect(ctx, x, y, width, height, radius);
    ctx.fill();

    // Reset shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 5;
    ctx.shadowOffsetY = 5;

    // Draw again for depth
    ctx.fillStyle = '#F5F5F5';
    this.roundRect(ctx, x, y, width, height, radius);
    ctx.fill();

    // Reset shadow
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  }

  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number
  ) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  private drawFooter(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = '#999999';
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText("Generated by BasePost's portfolio screen", this.width / 2, this.height - 30);
    ctx.fillText(new Date().toLocaleDateString(), this.width / 2, this.height - 10);
  }
}

