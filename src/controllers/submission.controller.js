import fs from 'fs';
import Submission from '../models/Submission.js';
import User from '../models/User.js';
import { sha256File } from '../utils/imageHash.js';
import { verifyWasteImage } from '../services/aiVerification.service.js';
import { maybeCreateSpotCheck } from '../services/spotCheck.service.js';

export async function createSubmission(req, res) {
  if (!req.file) return res.status(400).json({ message: 'image is required' });

  const hash = await sha256File(req.file.path);
  const duplicate = await Submission.findOne({ user: req.user._id, imageHash: hash });
  const ai = await verifyWasteImage({ filePath: req.file.path });

  const verified = ai.verified && ai.confidence >= 0.75 && ai.category !== 'mixed';
  const points = verified && !duplicate ? 10 : 0;
  const submission = await Submission.create({
    user: req.user._id,
    imageUrl: `/uploads/${req.file.filename}`,
    imageHash: hash,
    aiCategory: ai.category,
    aiConfidence: ai.confidence,
    verified,
    pointsAwarded: points,
    duplicateDetected: Boolean(duplicate),
    status: verified && !duplicate ? 'verified' : 'needs_review'
  });

  const spotCheck = await maybeCreateSpotCheck({ userId: req.user._id, submission, duplicateDetected: Boolean(duplicate) });
  if (spotCheck) {
    submission.spotCheckTriggered = true;
    submission.spotCheckReason = spotCheck.type;
    await submission.save();
  }

  if (verified && !duplicate) {
  const user = await User.findById(req.user._id);

  const now = new Date();

  // Convert date to YYYY-MM-DD
  function dateKey(date) {
    return date.toISOString().slice(0, 10);
  }

  const today = dateKey(now);

  const previousDate = user.lastVerifiedAt
    ? dateKey(new Date(user.lastVerifiedAt))
    : null;

  // First verified submission
  if (!previousDate) {
    user.streak = 1;
  }

  // Already submitted today
  else if (previousDate === today) {
    // Do NOT increase streak
    user.streak = user.streak || 1;
  }

  // Check if previous verified day was yesterday
  else {
    const yesterday = new Date(now);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);

    if (previousDate === dateKey(yesterday)) {
      user.streak += 1;
    } else {
      // Missed one or more days
      user.streak = 1;
    }
  }

  user.longestStreak = Math.max(
    user.longestStreak || 0,
    user.streak
  );

  user.points += points;

  user.lastVerifiedAt = now;

  await user.save();
}

  // Keep the uploaded file for the frontend demo. In production use object storage.
  if (!process.env.UPLOAD_DIR) fs.mkdirSync('uploads', { recursive: true });

 return res.status(201).json({
  submission,

  aiResult: {
    category: ai.category,
    confidence: ai.confidence,
    verified: ai.verified,
    items: ai.items,
    segregated: ai.segregated,
    imageQuality: ai.imageQuality,
    suspicious: ai.suspicious,

    resultType: ai.resultType,
    resultTitle: ai.resultTitle,
    resultMessage: ai.resultMessage,
    actionMessage: ai.actionMessage
  },

  spotCheck: spotCheck
    ? {
        id: spotCheck._id,
        type: spotCheck.type,
        reason: spotCheck.reason,
        expiresAt: spotCheck.expiresAt
      }
    : null
});
}

export async function listSubmissions(req, res) {
  const submissions = await Submission.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(50);
  res.json({ submissions });
}
