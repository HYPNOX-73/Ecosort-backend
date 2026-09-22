import mongoose from 'mongoose';

const redemptionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reward: { type: mongoose.Schema.Types.ObjectId, ref: 'Reward', required: true },
  pointsSpent: { type: Number, required: true },
  status: { type: String, enum: ['requested', 'fulfilled'], default: 'requested' }
}, { timestamps: true });

export default mongoose.model('Redemption', redemptionSchema);
