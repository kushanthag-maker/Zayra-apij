# Quick Start Guide

## 1️⃣ Local Development (1 min)

```bash
# Clone/extract project
cd zayra-api

# Copy env file
cp .env.example .env.local

# Edit .env.local (add your MongoDB URI and API keys)
nano .env.local

# Install dependencies
npm install

# Run development server
npm run dev

# Open http://localhost:3000
```

**Demo Credentials:**
- Username: `sandaru`
- Password: `sandaru7060`

## 2️⃣ MongoDB Setup (5 min)

Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas):

1. Create account (free)
2. Create free cluster (M0)
3. Click Connect
4. Connection String → Application
5. Copy string and paste in `.env.local`:
   ```
   MONGODB_URI=mongodb+srv://username:password@cluster0.mongodb.net/zayra_api
   ```

## 3️⃣ RapidAPI Setup (2 min)

1. Go to [RapidAPI](https://rapidapi.com)
2. Sign up (free)
3. Search "Facebook Video Downloader"
4. Subscribe to free tier
5. Copy API key to `.env.local`:
   ```
   RAPID_API_KEY=your_key_here
   ```

## 4️⃣ Deploy to Vercel (3 min)

```bash
# Option A: Push to GitHub first
git init
git add .
git commit -m "Initial"
git push origin main

# Then go to https://vercel.com
# Click "New Project"
# Select repo
# Add env vars (same as .env.local)
# Deploy!

# Option B: Direct CLI
npm install -g vercel
vercel --prod
```

## 5️⃣ Test Features

### Login
```
URL: https://yoursite.com
Username: sandaru
Password: sandaru7060
```

### Download Facebook Video
1. Get any Facebook video link
2. Paste URL in "Facebook Download" tab
3. Click "Download Video"
4. Download high/low quality

### Admin Dashboard
1. Login as `sandaru`
2. See system stats
3. View top users
4. Check API usage

## 📊 Project Structure

```
zayra-api/
├── app/
│   ├── api/
│   │   ├── auth/login         (Login endpoint)
│   │   ├── download/facebook  (Facebook DL API)
│   │   ├── admin/stats        (Admin stats)
│   │   └── user/profile       (User profile)
│   ├── layout.js              (Root layout)
│   └── page.js                (Main page)
├── components/
│   ├── LoginPage.js           (Login UI)
│   ├── Dashboard.js           (User dashboard)
│   └── AdminPanel.js          (Admin dashboard)
├── models/
│   ├── User.js                (User schema)
│   └── ApiUsage.js            (Usage tracking)
├── styles/
│   ├── globals.css
│   ├── auth.module.css
│   ├── dashboard.module.css
│   └── admin.module.css
├── lib/
│   └── mongodb.js             (DB connection)
├── .env.example               (Copy this to .env.local)
├── package.json
└── README.md
```

## 🔑 Key Features

✅ User Authentication (JWT)
✅ Facebook Video Download
✅ Admin Dashboard
✅ Credit System
✅ API Analytics
✅ Dark Cyber UI
✅ Responsive Design
✅ MongoDB Persistence

## 🚀 Next: Add More APIs

To add more APIs (like Instagram, YouTube):

1. Create new endpoint in `app/api/download/[platform]`
2. Implement download logic
3. Add UI component
4. Test & deploy

Example:
```javascript
// app/api/download/instagram/route.js
export async function POST(request) {
  const { url } = await request.json();
  // Call Instagram API
  // Return download links
}
```

## 💬 Commands Reference

```bash
npm run dev      # Start development
npm run build    # Build for production
npm start        # Start production server
npm run lint     # Check code quality
```

## 📝 Environment Variables

| Variable | Required | Example |
|----------|----------|---------|
| MONGODB_URI | ✅ | mongodb+srv://... |
| JWT_SECRET | ✅ | random_32_chars |
| ADMIN_USERNAME | ✅ | sandaru |
| ADMIN_PASSWORD | ✅ | sandaru7060 |
| RAPID_API_KEY | ✅ | your_key_here |
| NEXT_PUBLIC_API_URL | ❌ | http://localhost:3000 |

## ⚠️ Common Issues

**"Cannot connect to MongoDB"**
- Check connection string
- Add IP whitelist: 0.0.0.0/0
- Verify password doesn't have `@` (escape as `%40`)

**"Facebook download fails"**
- Check API key is valid
- Verify subscription is active
- Test URL is valid Facebook link

**"Unauthorized" error**
- Check username/password
- Clear browser cache
- Check JWT_SECRET is set

## 🎯 What's Included

✅ Complete Next.js project
✅ Authentication system
✅ MongoDB integration
✅ Facebook video downloader
✅ Admin analytics
✅ Production-ready code
✅ Dark cyber UI theme
✅ Responsive design
✅ Deployment docs

## 🔐 Security Notes

- JWT tokens expire in 7 days
- Passwords are hashed with bcrypt
- Admin credentials hardcoded (change in production)
- API keys should be stored as env vars
- HTTPS enforced on production

---

**Ready?** Start with Step 1 above! 🚀
