import mongoose from 'mongoose';

const submissionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  imageUrl: { type: String, required: true },
  imageHash: { type: String, required: true, index: true },
  aiCategory: {
  type: String,
  enum: ['wet', 'dry', 'recyclable', 'mixed', 'unknown'],
  default: 'unknown'
},
  aiConfidence: { type: Number, min: 0, max: 1, default: 0 },
  verified: { type: Boolean, default: false },
  pointsAwarded: { type: Number, default: 0 },
  duplicateDetected: { type: Boolean, default: false },
  spotCheckTriggered: { type: Boolean, default: false },
  spotCheckReason: { type: String, enum: ['random', 'before_collection', 'low_confidence', 'duplicate', null], default: null },
  status: { type: String, enum: ['verified', 'needs_review', 'rejected'], default: 'needs_review' }
}, { timestamps: true });

submissionSchema.index({ user: 1, createdAt: -1 });

export default mongoose.model('Submission', submissionSchema);
