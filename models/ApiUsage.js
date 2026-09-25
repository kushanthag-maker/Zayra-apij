import mongoose from 'mongoose';

const apiUsageSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  apiKey: String,
  endpoint: String,
  method: String,
  statusCode: Number,
  responseTime: Number,
  creditsCost: {
    type: Number,
    default: 1,
  },
  requestBody: mongoose.Schema.Types.Mixed,
  responseData: mongoose.Schema.Types.Mixed,
  ipAddress: String,
  userAgent: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export default mongoose.models.ApiUsage || mongoose.model('ApiUsage', apiUsageSchema);
