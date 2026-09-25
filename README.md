# 🚀 ZAYRA API - Sri Lankan Developer API Hub

Complete API management platform with Facebook video download functionality, admin dashboard, and user authentication.

## Features

- ✅ User authentication with JWT
- ✅ Admin dashboard with analytics
- ✅ Facebook video download API
- ✅ Credit-based system
- ✅ API usage tracking
- ✅ Dark cyber UI
- ✅ Responsive design
- ✅ MongoDB integration
- ✅ Vercel deployment ready

## Tech Stack

- **Frontend:** Next.js 14, React 18, CSS Modules
- **Backend:** Next.js API Routes
- **Database:** MongoDB
- **Authentication:** JWT
- **Deployment:** Vercel

## Setup Instructions

### 1. Clone & Install
```bash
npm install
```

### 2. Environment Setup
Copy `.env.example` to `.env.local` and fill in:
```bash
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/zayra_api
JWT_SECRET=your_secret_key_here_minimum_32_chars
ADMIN_USERNAME=sandaru
ADMIN_PASSWORD=sandaru7060
RAPID_API_KEY=your_rapidapi_key_for_facebook_videos
```

### 3. Local Development
```bash
npm run dev
```
Visit `http://localhost:3000`

### 4. Production Build
```bash
npm run build
npm start
```

## Default Credentials

- **Username:** sandaru
- **Password:** sandaru7060

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login

### Downloads
- `POST /api/download/facebook` - Download Facebook videos

### Admin
- `GET /api/admin/stats` - Get system statistics

## Vercel Deployment

### Option 1: Direct Push
```bash
vercel --prod
```

### Option 2: GitHub Integration
1. Push to GitHub
2. Connect repository to Vercel
3. Configure environment variables
4. Auto-deploy on push

## Required Environment Variables

For Vercel:
1. Go to Project Settings > Environment Variables
2. Add:
   - `MONGODB_URI`
   - `JWT_SECRET`
   - `ADMIN_USERNAME`
   - `ADMIN_PASSWORD`
   - `RAPID_API_KEY`

## Database Setup

1. Create MongoDB Atlas account (free tier available)
2. Create cluster and get connection string
3. Add your IP to whitelist
4. Set `MONGODB_URI` in environment variables

## Facebook Video Download

The API uses RapidAPI Facebook Video Downloader:
1. Sign up at [RapidAPI](https://rapidapi.com)
2. Subscribe to Facebook Video Downloader API
3. Get your API key
4. Set `RAPID_API_KEY` environment variable

## Credits System

- New users get 100 free credits
- Each Facebook download costs 1 credit
- Track usage in admin dashboard
- Export analytics data

## Troubleshooting

### "Unauthorized" error
- Check JWT token expiration
- Verify `JWT_SECRET` matches

### MongoDB connection failed
- Verify `MONGODB_URI` is correct
- Check IP whitelist in MongoDB Atlas
- Ensure network access is enabled

### Facebook download fails
- Verify RapidAPI key is valid
- Check internet connection
- URL must be valid Facebook video link

## Support

For issues and feature requests, create an issue or contact the team.

## License

MIT License - Free to use and modify

---

**Made for Sri Lankan Developers 🇱🇰**
