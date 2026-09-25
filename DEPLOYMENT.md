# 🚀 ZAYRA API - Vercel Deployment Guide

## Quick Start (5 minutes)

### Step 1: Prepare MongoDB

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create free account
3. Create cluster (M0 Free tier)
4. Wait for cluster to deploy (10-15 min)
5. Click "Connect"
6. Choose "Connect your application"
7. Copy connection string like:
   ```
   mongodb+srv://username:password@cluster0.mongodb.net/zayra_api
   ```
8. Replace `<password>` with your password

### Step 2: Get RapidAPI Key

1. Go to [RapidAPI](https://rapidapi.com)
2. Sign up (free)
3. Search for "Facebook Video Downloader"
4. Click "Subscribe to Test"
5. Copy your API Key from top right

### Step 3: Deploy to Vercel

#### Option A: GitHub (Recommended)

```bash
# 1. Push to GitHub
git init
git add .
git commit -m "Initial commit"
git push origin main

# 2. Go to https://vercel.com
# 3. Click "New Project"
# 4. Select your repository
# 5. Add Environment Variables (see below)
# 6. Click Deploy
```

#### Option B: CLI

```bash
# 1. Install Vercel CLI
npm install -g vercel

# 2. Deploy
vercel --prod

# 3. Follow prompts and add environment variables
```

#### Option C: Upload ZIP

```bash
# 1. Zip the project
zip -r zayra-api.zip . -x "node_modules/*" ".next/*" ".git/*"

# 2. Go to https://vercel.com/new
# 3. Click "Upload"
# 4. Upload the ZIP
# 5. Add Environment Variables
# 6. Deploy
```

### Step 4: Environment Variables

Add these to Vercel project settings:

| Variable | Value | Example |
|----------|-------|---------|
| `MONGODB_URI` | Your MongoDB connection string | `mongodb+srv://user:pass@cluster.mongodb.net/zayra_api` |
| `JWT_SECRET` | Any long random string | `my_super_secret_key_32_chars_minimum_ok_done` |
| `ADMIN_USERNAME` | Admin username | `sandaru` |
| `ADMIN_PASSWORD` | Admin password | `sandaru7060` |
| `RAPID_API_KEY` | Your RapidAPI key | (from RapidAPI account) |
| `NEXT_PUBLIC_API_URL` | Your Vercel URL | `https://zayra-api.vercel.app` |

### Step 5: Test

1. Go to your Vercel URL
2. Login with `sandaru` / `sandaru7060`
3. Test Facebook video download
4. Check admin panel for stats

## Troubleshooting

### Deploy fails with "MongoDB connection error"
- ✅ Check MONGODB_URI is correct
- ✅ Add Vercel IP to MongoDB whitelist (0.0.0.0/0)
- ✅ Ensure password doesn't have special chars (escape if needed)

### "Unauthorized" on login
- ✅ Check ADMIN_USERNAME matches `.env`
- ✅ Check ADMIN_PASSWORD matches `.env`
- ✅ Check JWT_SECRET is set (must be 32+ chars)

### Facebook download fails
- ✅ Verify RapidAPI key is valid
- ✅ Check API subscription is active
- ✅ Test with valid Facebook video URL

### Build fails
- ✅ Remove `node_modules` folder
- ✅ Run `npm install` locally
- ✅ Run `npm run build` to check for errors

## Production Checklist

- [ ] MongoDB Atlas cluster created
- [ ] RapidAPI subscription active
- [ ] Vercel project created
- [ ] Environment variables configured
- [ ] Build succeeds
- [ ] Login works
- [ ] Facebook download works
- [ ] Admin panel accessible
- [ ] Custom domain configured (optional)

## Custom Domain (Optional)

1. In Vercel project settings > Domains
2. Add your domain
3. Follow DNS setup instructions
4. Wait 24-48 hours for propagation

## Scaling & Performance

### Current Limits (Free)
- 100 serverless function invocations per month
- 50GB bandwidth
- 12 concurrent builds

### Upgrade to Pro when:
- Need more bandwidth
- Running production service
- Multiple APIs
- High traffic expected

## SSL/HTTPS

Automatically handled by Vercel ✅

## Monitoring

### Check Vercel Dashboard
1. Go to Vercel project
2. Analytics tab
3. View function logs, bandwidth, runtime

### Check MongoDB Usage
1. Go to MongoDB Atlas
2. Monitor storage, requests
3. View query performance

## Cost

| Service | Free Tier | Cost |
|---------|-----------|------|
| Vercel | ✅ Included | $0-20/mo Pro |
| MongoDB | 512MB | $0-57/mo paid |
| RapidAPI | Free tier | $0-50/mo |
| **Total** | **~$0** | **~$20-100/mo** |

## Next Steps

1. ✅ Deploy to Vercel
2. ✅ Test all features
3. ✅ Add custom domain
4. ✅ Setup monitoring
5. ✅ Add more APIs
6. ✅ Promote to users

---

**Questions?** Check README.md or create an issue!
