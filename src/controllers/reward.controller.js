import Reward from '../models/Reward.js';
import Redemption from '../models/Redemption.js';
import User from '../models/User.js';

export async function listRewards(req, res) {
  let rewards = await Reward.find({ active: true }).sort({ pointsCost: 1 });
  if (rewards.length === 0) {
    rewards = await Reward.insertMany([
      { title: 'Eco Badge', description: 'Digital sustainability badge', pointsCost: 50, stock: 999 },
      { title: 'Society Champion', description: 'Community recognition reward', pointsCost: 100, stock: 100 },
      { title: 'Eco Voucher', description: 'Demo reward voucher', pointsCost: 200, stock: 25 }
    ]);
  }
  res.json({ rewards });
}

export async function redeem(req, res) {
  const reward = await Reward.findById(req.params.rewardId);
  if (!reward || !reward.active) return res.status(404).json({ message: 'Reward not found' });
  if (reward.stock <= 0) return res.status(400).json({ message: 'Reward out of stock' });
  const user = await User.findById(req.user._id);
  if (user.points < reward.pointsCost) return res.status(400).json({ message: 'Not enough points' });
  user.points -= reward.pointsCost;
  reward.stock -= 1;
  await Promise.all([user.save(), reward.save(), Redemption.create({ user: user._id, reward: reward._id, pointsSpent: reward.pointsCost })]);
  res.json({ message: 'Reward redemption requested', pointsRemaining: user.points });
}
