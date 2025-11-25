# Troubleshooting Guide

## Issue: Tokens not displaying / Everything shows 0

### Possible causes:

1. **BaseScan API not working or rate limited**
   - Check browser console (F12) for errors
   - Check server logs in terminal
   - BaseScan API may have limits without an API key

2. **Missing API key**
   - Create a `.env.local` file in the project root
   - Add: `NEXT_PUBLIC_BASESCAN_API_KEY=your_etherscan_key_here`
   - Get your key at https://etherscan.io/apidashboard
   - **Important**: Etherscan API V2 is used (works for all networks including Base)

3. **Wallet connection issues**
   - Make sure you're using Base Account SDK ("Sign in with Base")
   - Ensure you have Base app or extension installed
   - If Base Account SDK is not loading, check browser console for errors
   - Make sure Base Account SDK script is loading (check Network tab)

4. **No tokens in wallet**
   - Make sure you actually have tokens in your wallet
   - Check on BaseScan: https://basescan.org/address/YOUR_ADDRESS

### How to check:

1. Open browser console (F12 → Console)
2. Connect wallet
3. Click "Analyze Portfolio"
4. Check logs:
   - `Fetching token balances from: ...`
   - `BaseScan API response status: ...`
   - `Found X tokens in wallet`

### Solution:

If you see API errors:
- Add BaseScan API key to `.env.local`
- Or wait a few minutes (rate limit)

If tokens are not found:
- Check that wallet address is correct
- Make sure tokens actually exist on Base network
