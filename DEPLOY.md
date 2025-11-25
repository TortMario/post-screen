# Deploy to Vercel via GitHub

This guide will help you deploy BasePost's portfolio screen to Vercel.

## Prerequisites

1. GitHub account
2. Vercel account (can be created via GitHub)
3. API keys for BaseScan and CoinGecko

## Deployment Steps

### 1. Repository Preparation

Make sure your project is ready:

```bash
# Check that the project builds
npm run build

# Make sure all dependencies are installed
npm install
```

### 2. Upload Project to GitHub

If the project is not on GitHub yet:

```bash
# Initialize git repository (if not already initialized)
git init

# Add all files
git add .

# Make first commit
git commit -m "Initial commit: BasePost's portfolio screen"

# Create repository on GitHub and add remote
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git branch -M main
git push -u origin main
```

### 3. Connect to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click **"Add New Project"**
3. Select your GitHub repository
4. Vercel will automatically detect the Next.js project

### 4. Environment Variables Setup

In the project settings on Vercel, add the following Environment Variables:

```
NEXT_PUBLIC_BASESCAN_API_KEY=your_etherscan_api_key
NEXT_PUBLIC_COINGECKO_API_KEY=your_coingecko_api_key
```

**Where to find:**
- **BaseScan API Key**: [Etherscan API Dashboard](https://etherscan.io/apidashboard)
- **CoinGecko API Key**: [CoinGecko API](https://www.coingecko.com/en/api)

### 5. Deployment Settings

Vercel will automatically detect settings from `vercel.json`, but you can verify:

- **Framework Preset**: Next.js
- **Build Command**: `npm run build` (automatic)
- **Output Directory**: `.next` (automatic)
- **Install Command**: `npm install` (automatic)

### 6. Deploy

1. Click **"Deploy"**
2. Wait for the build to complete (usually 2-3 minutes)
3. After successful deployment, you'll get a URL like: `https://your-project.vercel.app`

### 7. Verify

After deployment, check:

1. ✅ Page loads
2. ✅ Base Account SDK loads (check browser console)
3. ✅ "Sign in with Base" works
4. ✅ Portfolio analysis works

## Updating Project

After each push to GitHub main branch, Vercel will automatically deploy:

```bash
git add .
git commit -m "Update: your changes"
git push
```

## Troubleshooting

### Build Error

- Check logs in Vercel Dashboard
- Make sure all dependencies are listed in `package.json`
- Verify that environment variables are configured correctly

### Canvas Errors

The `canvas` library requires native dependencies. On Vercel, they should install automatically, but if there are issues:

1. Check that `canvas` is in `dependencies`, not in `devDependencies`
2. Make sure you're using the latest version of Next.js

### Base Account SDK Not Loading

1. Check CSP headers in `next.config.js`
2. Make sure `unpkg.com` is allowed in `script-src`
3. Check browser console for errors

### API Errors

- Verify that API keys are correctly configured in Environment Variables
- Make sure keys don't have spaces or quotes
- Check API limits (BaseScan and CoinGecko have request limits)

## Domain Setup (Optional)

1. In project settings on Vercel, go to **Settings → Domains**
2. Add your domain
3. Follow instructions for DNS configuration

## Production Optimizations

After first deployment, it's recommended to:

1. ✅ Enable caching in Vercel
2. ✅ Set up monitoring (Vercel Analytics)
3. ✅ Configure Webhook for automatic updates
4. ✅ Add icons for PWA (create `icon-192.png` and `icon-512.png` in `public/`)

## Support

If you encounter issues:

1. Check [Vercel Documentation](https://vercel.com/docs)
2. Check [Next.js Documentation](https://nextjs.org/docs)
3. Check logs in Vercel Dashboard
