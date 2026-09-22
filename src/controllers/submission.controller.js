import fs from 'fs';

import Submission from '../models/Submission.js';
import User from '../models/User.js';

import { sha256File } from '../utils/imageHash.js';

import { verifyWasteImage } from '../services/aiVerification.service.js';
import { verifySeparation } from '../services/separationVerification.service.js';

import { maybeCreateSpotCheck } from '../services/spotCheck.service.js';


/*
|--------------------------------------------------------------------------
| India Date Helpers
|--------------------------------------------------------------------------
|
| EcoSort uses Asia/Kolkata calendar dates.
|
| Example:
| 2026-09-20
|
*/

function indiaDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}


function indiaYesterdayDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);

  const year = Number(parts.find((p) => p.type === 'year').value);
  const month = Number(parts.find((p) => p.type === 'month').value);
  const day = Number(parts.find((p) => p.type === 'day').value);

  /*
   * Use UTC internally only to subtract one calendar day.
   * The resulting date is then converted back to India date.
   */
  const indiaDate = new Date(
    Date.UTC(year, month - 1, day)
  );

  indiaDate.setUTCDate(indiaDate.getUTCDate() - 1);

  return indiaDate.toISOString().slice(0, 10);
}


/*
|--------------------------------------------------------------------------
| Update Streak + Daily Reward
|--------------------------------------------------------------------------
|
| Rules:
|
| First successful verification of the day:
|   +10 points
|   streak updated
|
| Second/third/etc successful verification same day:
|   +0 points
|   streak unchanged
|
| Next calendar day:
|   streak +1
|
| Missed day(s):
|   streak resets to 1
|
*/

async function applyDailyReward(userId) {
  const user = await User.findById(userId);

  if (!user) {
    throw new Error('User not found');
  }

  const now = new Date();

  const today = indiaDateKey(now);

  const previousRewardDate =
    user.lastVerifiedDateKey ||
    (
      user.lastVerifiedAt
        ? indiaDateKey(new Date(user.lastVerifiedAt))
        : null
    );

  let pointsAwarded = 0;
  let streakUpdated = false;
  let alreadyRewardedToday = false;

  /*
   * First successful verification ever
   */
  if (!previousRewardDate) {
    user.streak = 1;

    pointsAwarded = 10;

    streakUpdated = true;
  }

  /*
   * Already earned today's reward
   */
  else if (previousRewardDate === today) {
    alreadyRewardedToday = true;

    pointsAwarded = 0;

    /*
     * DO NOT increase streak.
     */
    user.streak = user.streak || 1;
  }

  /*
   * A new day
   */
  else {
    const yesterday = indiaYesterdayDateKey(now);

    /*
     * Consecutive day
     */
    if (previousRewardDate === yesterday) {
      user.streak = (user.streak || 0) + 1;
    }

    /*
     * Missed one or more days
     */
    else {
      user.streak = 1;
    }

    pointsAwarded = 10;

    streakUpdated = true;
  }

  /*
   * Update longest streak
   */
  user.longestStreak = Math.max(
    user.longestStreak || 0,
    user.streak || 0
  );

  /*
   * Only add points for the first successful
   * verification of the calendar day.
   */
  user.points = (user.points || 0) + pointsAwarded;

  /*
   * Keep track of when the successful verification happened.
   */
  if (!alreadyRewardedToday) {
    user.lastVerifiedAt = now;
    user.lastVerifiedDateKey = today;
  }

  await user.save();

  return {
    pointsAwarded,
    alreadyRewardedToday,
    streak: user.streak,
    longestStreak: user.longestStreak,
    totalPoints: user.points,
    streakUpdated
  };
}


/*
|--------------------------------------------------------------------------
| Normal single-photo submission
|--------------------------------------------------------------------------
*/

export async function createSubmission(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({
        message: 'image is required'
      });
    }

    /*
     * SHA-256 exact duplicate check
     */
    const hash = await sha256File(req.file.path);

    const duplicate = await Submission.findOne({
      user: req.user._id,
      imageHash: hash
    });

    /*
     * AI verification
     */
    const ai = await verifyWasteImage({
      filePath: req.file.path
    });

    const verified =
      ai.verified === true &&
      ai.confidence >= 0.75 &&
      ai.category !== 'mixed';

    /*
     * Only verified + non-duplicate submissions
     * can receive the daily reward.
     */
    let reward = {
      pointsAwarded: 0,
      alreadyRewardedToday: false,
      streak: 0,
      longestStreak: 0,
      totalPoints: 0
    };

    if (verified && !duplicate) {
      reward = await applyDailyReward(req.user._id);
    }

    const points = duplicate ? 0 : reward.pointsAwarded;

    const submission = await Submission.create({
      user: req.user._id,

      imageUrl: `/uploads/${req.file.filename}`,
      imageHash: hash,

      verificationType: 'single',

      aiCategory: ai.category,
      aiConfidence: ai.confidence,

      verified,

      pointsAwarded: points,

      duplicateDetected: Boolean(duplicate),

      dailyRewardAlreadyClaimed:
        Boolean(reward.alreadyRewardedToday),

      status:
        verified && !duplicate
          ? 'verified'
          : 'needs_review'
    });

    /*
     * Spot check
     */
    const spotCheck = await maybeCreateSpotCheck({
      userId: req.user._id,
      submission,
      duplicateDetected: Boolean(duplicate)
    });

    if (spotCheck) {
      submission.spotCheckTriggered = true;
      submission.spotCheckReason = spotCheck.type;

      await submission.save();
    }

    return res.status(201).json({
      submission,

      reward,

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

      duplicate: Boolean(duplicate),

      duplicateMessage: duplicate
        ? 'Duplicate Photo Detected. This exact photo has already been submitted.'
        : null,

      spotCheck: spotCheck
        ? {
            id: spotCheck._id,
            type: spotCheck.type,
            reason: spotCheck.reason,
            expiresAt: spotCheck.expiresAt
          }
        : null
    });

  } catch (error) {
    console.error('Create submission error:', error);

    return res.status(500).json({
      message: 'Failed to process submission.'
    });
  }
}


/*
|--------------------------------------------------------------------------
| BEFORE + AFTER SEPARATION SUBMISSION
|--------------------------------------------------------------------------
|
| Flow:
|
| BEFORE PHOTO
|       ↓
| SHA-256
|       ↓
| duplicate check
|       ↓
| AFTER PHOTO
|       ↓
| SHA-256
|       ↓
| duplicate check
|       ↓
| Gemini before/after verification
|       ↓
| verified?
|       ↓
| daily reward + streak
|       ↓
| save to MongoDB
|
*/

export async function createSeparationSubmission(
  req,
  res
) {
  try {
    const beforeFile =
      req.files?.beforeImage?.[0];

    const afterFile =
      req.files?.afterImage?.[0];


    /*
     * Validate both photos
     */
    if (!beforeFile) {
      return res.status(400).json({
        success: false,
        message: 'Before-separation photo is required.'
      });
    }

    if (!afterFile) {
      return res.status(400).json({
        success: false,
        message: 'After-separation photo is required.'
      });
    }


    /*
     * Hash both images
     */
    const beforeHash =
      await sha256File(beforeFile.path);

    const afterHash =
      await sha256File(afterFile.path);


    /*
     * Same file used for before + after
     */
    if (beforeHash === afterHash) {
      return res.status(400).json({
        success: false,

        duplicate: true,

        message:
          'The before and after photos are identical. Please take a new after-separation photo.'
      });
    }


    /*
     * Exact pair duplicate
     */
    const duplicatePair =
      await Submission.findOne({
        user: req.user._id,

        beforeImageHash: beforeHash,
        afterImageHash: afterHash
      });


    /*
     * Also check if the same before photo
     * or after photo was already used.
     *
     * This makes the duplicate protection stronger.
     */
    const repeatedImage =
      await Submission.findOne({
        user: req.user._id,

        $or: [
          {
            beforeImageHash: beforeHash
          },
          {
            afterImageHash: beforeHash
          },
          {
            beforeImageHash: afterHash
          },
          {
            afterImageHash: afterHash
          }
        ]
      });


    const duplicate =
      Boolean(duplicatePair || repeatedImage);


    /*
     * If exact/repeated photo detected,
     * DO NOT award points.
     *
     * Still save the attempt so the system
     * has a record of the duplicate.
     */
    if (duplicate) {
      const duplicateSubmission =
        await Submission.create({
          user: req.user._id,

          beforeImageUrl:
            `/uploads/${beforeFile.filename}`,

          afterImageUrl:
            `/uploads/${afterFile.filename}`,

          beforeImageHash: beforeHash,
          afterImageHash: afterHash,

          verificationType: 'separation',

          aiCategory: 'unknown',
          aiConfidence: 0,

          verified: false,

          pointsAwarded: 0,

          duplicateDetected: true,

          status: 'rejected',

          resultType: 'duplicate',

          resultTitle:
            'Duplicate Photo Detected',

          resultMessage:
            'This photo has already been submitted.',

          actionMessage:
            'Please take fresh before and after photos.'
        });

      return res.status(409).json({
        success: false,

        duplicate: true,

        result: {
          verified: false,

          confidence: 0,

          resultType: 'duplicate',

          resultTitle:
            'Duplicate Photo Detected',

          resultMessage:
            'We have already received one of these photos before.',

          actionMessage:
            'Please take fresh before and after photos.',

          pointsAwarded: 0
        },

        submission: duplicateSubmission
      });
    }


    /*
     * Gemini before/after verification
     */
    console.log(
      'Starting EcoSort before/after verification...'
    );

    const result =
      await verifySeparation({
        beforeFilePath:
          beforeFile.path,

        afterFilePath:
          afterFile.path
      });


    /*
     * Only AI-approved separation can continue
     */
    const verified =
      result.verified === true &&
      result.beforeWasteDetected === true &&
      result.afterWasteDetected === true &&
      result.sameWasteLikely === true &&
      result.separationDetected === true &&
      result.suspicious === false &&
      result.confidence >= 0.75;


    /*
     * If verification failed,
     * save the attempt but give 0 points.
     */
    if (!verified) {
      const rejectedSubmission =
        await Submission.create({
          user: req.user._id,

          beforeImageUrl:
            `/uploads/${beforeFile.filename}`,

          afterImageUrl:
            `/uploads/${afterFile.filename}`,

          beforeImageHash: beforeHash,
          afterImageHash: afterHash,

          verificationType: 'separation',

          aiCategory: 'unknown',

          aiConfidence:
            result.confidence || 0,

          verified: false,

          pointsAwarded: 0,

          duplicateDetected: false,

          status: 'needs_review',

          resultType:
            result.resultType || 'rejected',

          resultTitle:
            result.resultTitle,

          resultMessage:
            result.resultMessage,

          actionMessage:
            result.actionMessage,

          beforeItems:
            result.beforeItems || [],

          afterItems:
            result.afterItems || [],

          matchingItems:
            result.matchingItems || [],

          missingItems:
            result.missingItems || [],

          sameWasteLikely:
            result.sameWasteLikely || false,

          separationDetected:
            result.separationDetected || false,

          suspicious:
            result.suspicious || false,

          reason:
            result.reason || null
        });

      return res.status(200).json({
        success: true,

        result: {
          ...result,

          verified: false,

          pointsAwarded: 0,

          streak: req.user.streak || 0,

          totalPoints: req.user.points || 0
        },

        submission: rejectedSubmission
      });
    }


    /*
     * VERIFIED
     *
     * Now apply daily points + streak.
     */
    const reward =
      await applyDailyReward(req.user._id);


    /*
     * Save actual submission in MongoDB
     */
    const submission =
      await Submission.create({
        user: req.user._id,

        beforeImageUrl:
          `/uploads/${beforeFile.filename}`,

        afterImageUrl:
          `/uploads/${afterFile.filename}`,

        beforeImageHash: beforeHash,
        afterImageHash: afterHash,

        verificationType: 'separation',

        aiCategory: 'recyclable',

        aiConfidence:
          result.confidence,

        verified: true,

        pointsAwarded:
          reward.pointsAwarded,

        duplicateDetected: false,

        dailyRewardAlreadyClaimed:
          reward.alreadyRewardedToday,

        status: 'verified',

        resultType:
          result.resultType,

        resultTitle:
          result.resultTitle,

        resultMessage:
          result.resultMessage,

        actionMessage:
          result.actionMessage,

        beforeItems:
          result.beforeItems || [],

        afterItems:
          result.afterItems || [],

        matchingItems:
          result.matchingItems || [],

        missingItems:
          result.missingItems || [],

        sameWasteLikely:
          result.sameWasteLikely,

        separationDetected:
          result.separationDetected,

        suspicious:
          result.suspicious,

        reason:
          result.reason
      });


    /*
     * Spot check
     */
    const spotCheck =
      await maybeCreateSpotCheck({
        userId: req.user._id,

        submission,

        duplicateDetected: false
      });


    if (spotCheck) {
      submission.spotCheckTriggered = true;

      submission.spotCheckReason =
        spotCheck.type;

      await submission.save();
    }


    /*
     * Get updated user
     */
    const updatedUser =
      await User.findById(req.user._id)
        .select(
          '-passwordHash'
        );


    return res.status(201).json({
      success: true,

      result: {
        ...result,

        verified: true,

        pointsAwarded:
          reward.pointsAwarded,

        alreadyRewardedToday:
          reward.alreadyRewardedToday,

        streak:
          reward.streak,

        longestStreak:
          reward.longestStreak,

        totalPoints:
          reward.totalPoints
      },

      submission,

      user: updatedUser,

      spotCheck: spotCheck
        ? {
            id: spotCheck._id,
            type: spotCheck.type,
            reason: spotCheck.reason,
            expiresAt: spotCheck.expiresAt
          }
        : null
    });

  } catch (error) {
    console.error(
      'Separation submission error:',
      error
    );

    return res.status(500).json({
      success: false,

      message:
        'Failed to verify and save the before and after photos.'
    });
  }
}


/*
|--------------------------------------------------------------------------
| List submissions
|--------------------------------------------------------------------------
*/

export async function listSubmissions(
  req,
  res
) {
  try {
    const submissions =
      await Submission.find({
        user: req.user._id
      })
        .sort({
          createdAt: -1
        })
        .limit(50);

    return res.json({
      submissions
    });

  } catch (error) {
    console.error(
      'List submissions error:',
      error
    );

    return res.status(500).json({
      message:
        'Failed to load submissions.'
    });
  }
}