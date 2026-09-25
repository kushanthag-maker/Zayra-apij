import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import ApiUsage from '@/models/ApiUsage';

async function verifyAdmin(token) {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded.isAdmin === true;
  } catch (error) {
    return false;
  }
}

export async function GET(request) {
  try {
    await connectDB();
    
    const token = request.headers.get('authorization')?.split(' ')[1];
    const isAdmin = await verifyAdmin(token);

    if (!isAdmin) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get statistics
    const totalUsers = await User.countDocuments();
    const totalRequests = await ApiUsage.countDocuments();
    const totalCreditsUsed = await ApiUsage.aggregate([
      { $group: { _id: null, total: { $sum: '$creditsCost' } } },
    ]);

    const topUsers = await User.find()
      .select('username credits createdAt')
      .limit(10);

    const recentRequests = await ApiUsage.find()
      .select('endpoint method statusCode responseTime createdAt')
      .sort({ createdAt: -1 })
      .limit(20);

    return NextResponse.json(
      {
        success: true,
        stats: {
          totalUsers,
          totalRequests,
          totalCreditsUsed: totalCreditsUsed[0]?.total || 0,
        },
        topUsers,
        recentRequests,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Admin stats error:', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
