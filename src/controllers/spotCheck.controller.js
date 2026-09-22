import fs from 'fs';
import SpotCheck from '../models/SpotCheck.js';
import { sha256File } from '../utils/imageHash.js';
import { verifyWasteImage } from '../services/aiVerification.service.js';

export async function listSpotChecks(req, res) {
  const checks = await SpotCheck.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(50);
  res.json({ checks });
}

export async function submitSpotCheck(req, res) {
  const check = await SpotCheck.findOne({ _id: req.params.id, user: req.user._id });
  if (!check) return res.status(404).json({ message: 'Spot check not found' });
  if (check.status !== 'pending') return res.status(400).json({ message: 'Spot check is no longer pending' });
  if (new Date() > check.expiresAt) {
    check.status = 'expired';
    await check.save();
    return res.status(400).json({ message: 'Spot check expired' });
  }
  if (!req.file) return res.status(400).json({ message: 'image is required' });

  const hash = await sha256File(req.file.path);
  const ai = await verifyWasteImage({ filePath: req.file.path });
  const passed = ai.verified && ai.confidence >= 0.75 && ai.category !== 'mixed';
  check.status = passed ? 'passed' : 'failed';
  check.responseImageUrl = `/uploads/${req.file.filename}`;
  check.responseImageHash = hash;
  check.aiConfidence = ai.confidence;
  check.aiCategory = ai.category;
  await check.save();

  res.json({ check, passed });
}

export async function createBeforeCollection(req, res) {
  const check = await import('../services/spotCheck.service.js').then(m => m.createBeforeCollectionCheck(req.user._id));
  res.status(201).json({ check });
}
