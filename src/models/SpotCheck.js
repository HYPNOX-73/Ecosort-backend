import mongoose from 'mongoose';

const spotCheckSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  sourceSubmission: { type: mongoose.Schema.Types.ObjectId, ref: 'Submission', default: null },
  type: { type: String, enum: ['random', 'before_collection', 'low_confidence', 'duplicate'], required: true },
  reason: { type: String, required: true },
  status: { type: String, enum: ['pending', 'passed', 'failed', 'expired'], default: 'pending' },
  requestedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, default: () => new Date(Date.now() + 30 * 60 * 1000) },
  responseImageUrl: { type: String, default: null },
  responseImageHash: { type: String, default: null },
  aiConfidence: { type: Number, default: null },
  aiCategory: { type: String, default: null }
}, { timestamps: true });

export default mongoose.model('SpotCheck', spotCheckSchema);
