import User from '../models/User.js';
import Submission from '../models/Submission.js';
import SpotCheck from '../models/SpotCheck.js';

export async function dashboard(req, res) {
  const user = await User.findById(req.user._id).lean();
  const [total, verified, pendingSpotChecks] = await Promise.all([
    Submission.countDocuments({ user: req.user._id }),
    Submission.countDocuments({ user: req.user._id, status: 'verified' }),
    SpotCheck.countDocuments({ user: req.user._id, status: 'pending' })
  ]);
  res.json({
    user: { name: user.name, points: user.points, streak: user.streak, longestStreak: user.longestStreak },
    stats: { totalSubmissions: total, verifiedSubmissions: verified, pendingSpotChecks }
  });
}
