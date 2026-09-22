import SpotCheck from '../models/SpotCheck.js';

const RANDOM_PROBABILITY = 0.15;
const LOW_CONFIDENCE = 0.75;

export async function maybeCreateSpotCheck({ userId, submission, duplicateDetected }) {
  let type = null;
  let reason = null;

  if (duplicateDetected) {
    type = 'duplicate';
    reason = 'Highly similar/exact duplicate photo detected.';
  } else if (submission.aiConfidence < LOW_CONFIDENCE) {
    type = 'low_confidence';
    reason = 'AI confidence was below the verification threshold.';
  } else if (Math.random() < RANDOM_PROBABILITY) {
    type = 'random';
    reason = 'Random fresh-photo verification.';
  }

  if (!type) return null;

  return SpotCheck.create({
    user: userId,
    sourceSubmission: submission._id,
    type,
    reason
  });
}

export async function createBeforeCollectionCheck(userId) {
  return SpotCheck.create({
    user: userId,
    type: 'before_collection',
    reason: 'Fresh-photo verification requested before waste collection.'
  });
}
