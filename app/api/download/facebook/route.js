import { NextResponse } from 'next/server';
import axios from 'axios';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import ApiUsage from '@/models/ApiUsage';
import jwt from 'jsonwebtoken';

const RAPID_API_KEY = process.env.RAPID_API_KEY;

async function verifyToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return null;
  }
}

export async function POST(request) {
  try {
    await connectDB();
    
    const { url } = await request.json();
    const token = request.headers.get('authorization')?.split(' ')[1];
    const decoded = await verifyToken(token);

    if (!decoded) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Validate URL
    if (!url || !url.includes('facebook.com') && !url.includes('fb.com')) {
      return NextResponse.json(
        { success: false, message: 'Invalid Facebook URL' },
        { status: 400 }
      );
    }

    // Get user and check credits
    const user = await User.findOne({ username: decoded.username });
    if (!user || user.credits < 1) {
      return NextResponse.json(
        { success: false, message: 'Insufficient credits' },
        { status: 402 }
      );
    }

    const startTime = Date.now();

    // Call Facebook video download API
    const options = {
      method: 'GET',
      url: 'https://facebook-video-downloader.p.rapidapi.com/',
      params: {
        url: url,
      },
      headers: {
        'X-RapidAPI-Key': RAPID_API_KEY,
        'X-RapidAPI-Host': 'facebook-video-downloader.p.rapidapi.com',
      },
    };

    const response = await axios.request(options);
    const responseTime = Date.now() - startTime;

    if (!response.data.success) {
      return NextResponse.json(
        { success: false, message: 'Failed to download video' },
        { status: 400 }
      );
    }

    // Deduct credits
    user.credits -= 1;
    await user.save();

    // Log API usage
    await ApiUsage.create({
      userId: user._id,
      apiKey: token,
      endpoint: '/api/download/facebook',
      method: 'POST',
      statusCode: 200,
      responseTime,
      creditsCost: 1,
      requestBody: { url },
      responseData: {
        title: response.data.title,
        duration: response.data.duration,
        hasVideo: !!response.data.video,
        hasAudio: !!response.data.audio,
      },
      ipAddress: request.headers.get('x-forwarded-for'),
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          title: response.data.title,
          description: response.data.description,
          thumbnail: response.data.thumbnail,
          duration: response.data.duration,
          quality: response.data.quality,
          video: response.data.video,
          audio: response.data.audio,
          download_url: response.data.download_url,
        },
        creditsRemaining: user.credits,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Facebook download error:', error);
    return NextResponse.json(
      { success: false, message: 'Server error: ' + error.message },
      { status: 500 }
    );
  }
}
