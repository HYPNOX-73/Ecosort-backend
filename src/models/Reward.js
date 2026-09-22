import mongoose from 'mongoose';

const rewardSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, default: '' },
  pointsCost: { type: Number, required: true, min: 1 },
  stock: { type: Number, default: 0 },
  active: { type: Boolean, default: true }
}, { timestamps: true });

export default mongoose.model('Reward', rewardSchema);
