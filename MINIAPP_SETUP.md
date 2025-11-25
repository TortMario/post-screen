# Mini App Setup Guide

## 📋 Prerequisites

1. Your app must be deployed and accessible via HTTPS
2. You need a Base Build account and wallet address: `0xf1A98A5E238Af4eEA970E3b02973Cf6f4F1741Ac`
3. You need app icons and images (see requirements below)

## 🎨 Required Assets

### Icons & Images

You need to create/upload the following assets:

1. **Icon** (1024×1024px PNG):
   - Place at `/public/icon-512.png` (or update URL in manifest)
   - Transparent background discouraged
   - Used for: app icon, splash screen

2. **Splash Image** (recommended 200×200px):
   - Can reuse icon or create separate image
   - Place at `/public/splash.png` (or update URL in manifest)

3. **Hero Image** (1200×630px, 1.91:1 ratio):
   - For app profile page
   - Place at `/public/hero.png` (or update URL in manifest)

4. **Screenshots** (optional, max 3):
   - Portrait 1284×2778px recommended
   - Place at `/public/screenshot1.png`, etc.

**Tip**: Use [Mini App Assets Generator](https://www.miniappassets.com/) to generate properly formatted assets.

## 📝 Step-by-Step Setup

### 1. Update Manifest File

Edit `public/.well-known/farcaster.json`:

1. **Replace `YOUR-DOMAIN`** with your actual deployment domain:
   ```json
   "homeUrl": "https://your-app.vercel.app",
   "iconUrl": "https://your-app.vercel.app/icon-512.png",
   ```

2. **Update all URLs** that contain `YOUR-DOMAIN` with your actual domain

3. **Add screenshot URLs** (if you have them):
   ```json
   "screenshotUrls": [
     "https://your-app.vercel.app/screenshot1.png",
     "https://your-app.vercel.app/screenshot2.png"
   ]
   ```

### 2. Verify Manifest is Accessible

After deploying, verify the manifest is accessible at:
```
https://your-domain.com/.well-known/farcaster.json
```

You should see the JSON file when visiting this URL in a browser.

### 3. Generate Account Association

1. Navigate to [Base Build Account Association Tool](https://www.base.dev/preview?tab=account)

2. Paste your domain (e.g., `your-app.vercel.app`) in the "App URL" field

3. Click "Submit"

4. Click "Verify" and sign the manifest with your wallet

5. Copy the generated `accountAssociation` fields:
   - `header`
   - `payload`
   - `signature`

6. Paste them into `public/.well-known/farcaster.json`:
   ```json
   "accountAssociation": {
     "header": "eyJmaWQiOjkxNTIsInR5cGUiOiJjdXN0b2R5Iiwia2V5IjoiMHgwMmVmNzkwRGQ3OTkzQTM1ZkQ4NDdDMDUzRURkQUU5NDBEMDU1NTk2In0",
     "payload": "eyJkb21haW4iOiJhcHAuZXhhbXBsZS5jb20ifQ",
     "signature": "MHgxMGQwZGU4ZGYwZDUwZTdmMGIxN2YxMTU2NDI1MjRmZTY0MTUyZGU4ZGU1MWU0MThiYjU4ZjVmZmQxYjRjNDBiNGVlZTRhNDcwNmVmNjhlMzQ0ZGQ5MDBkYmQyMmNlMmVlZGY5ZGQ0N2JlNWRmNzMwYzUxNjE4OWVjZDJjY2Y0MDFj"
   }
   ```

### 4. Deploy and Verify

1. Commit and push your changes:
   ```bash
   git add public/.well-known/farcaster.json
   git commit -m "Add Mini App manifest"
   git push
   ```

2. Wait for deployment to complete

3. Verify manifest is accessible:
   - Visit `https://your-domain.com/.well-known/farcaster.json`
   - Should return valid JSON

4. Import your Mini App in Base Build:
   - Go to [Base Build](https://www.base.dev/build)
   - Import your Mini App using your domain
   - The manifest will be automatically read

## ✅ Verification Checklist

- [ ] Manifest file exists at `/public/.well-known/farcaster.json`
- [ ] All `YOUR-DOMAIN` placeholders replaced with actual domain
- [ ] All image URLs are valid and accessible
- [ ] `accountAssociation` fields are filled (header, payload, signature)
- [ ] `baseBuilder.ownerAddress` is correct: `0xf1A98A5E238Af4eEA970E3b02973Cf6f4F1741Ac`
- [ ] Manifest is accessible at `https://your-domain.com/.well-known/farcaster.json`
- [ ] All required images are uploaded and accessible
- [ ] App is deployed and live

## 🔍 Troubleshooting

### Manifest not accessible

- Check that file is in `public/.well-known/farcaster.json`
- Verify deployment includes the file
- Check Vercel/Next.js static file serving configuration

### Account association fails

- Make sure you're using the correct wallet address
- Verify domain matches exactly (no trailing slashes)
- Check that manifest is accessible before verifying

### Images not loading

- Verify all image URLs are HTTPS
- Check that images exist at specified paths
- Ensure images are publicly accessible (not behind auth)

## 📚 Resources

- [Base Build Documentation](https://docs.base.org/)
- [Mini App Assets Generator](https://www.miniappassets.com/)
- [Base Build Account Association Tool](https://www.base.dev/preview?tab=account)

