import mongoose from 'mongoose';

const submissionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },

    /*
     * Normal single-photo submission
     */
    imageUrl: {
      type: String,
      default: null
    },

    imageHash: {
      type: String,
      default: null,
      index: true
    },

    /*
     * Before / After separation submission
     */
    beforeImageUrl: {
      type: String,
      default: null
    },

    afterImageUrl: {
      type: String,
      default: null
    },

    beforeImageHash: {
      type: String,
      default: null
    },

    afterImageHash: {
      type: String,
      default: null
    },

    verificationType: {
      type: String,
      enum: ['single', 'separation'],
      default: 'single'
    },

    aiCategory: {
      type: String,
      enum: ['wet', 'dry', 'recyclable', 'mixed', 'unknown'],
      default: 'unknown'
    },

    aiConfidence: {
      type: Number,
      min: 0,
      max: 1,
      default: 0
    },

    verified: {
      type: Boolean,
      default: false
    },

    pointsAwarded: {
      type: Number,
      default: 0
    },

    duplicateDetected: {
      type: Boolean,
      default: false
    },

    /*
     * Used when a user has already earned
     * the daily reward.
     */
    dailyRewardAlreadyClaimed: {
      type: Boolean,
      default: false
    },

    spotCheckTriggered: {
      type: Boolean,
      default: false
    },

    spotCheckReason: {
      type: String,
      enum: [
        'random',
        'before_collection',
        'low_confidence',
        'duplicate',
        null
      ],
      default: null
    },

    status: {
      type: String,
      enum: ['verified', 'needs_review', 'rejected'],
      default: 'needs_review'
    },

    /*
     * Separation verification information
     */
    resultType: {
      type: String,
      default: null
    },

    resultTitle: {
      type: String,
      default: null
    },

    resultMessage: {
      type: String,
      default: null
    },

    actionMessage: {
      type: String,
      default: null
    },

    beforeItems: {
      type: [String],
      default: []
    },

    afterItems: {
      type: [String],
      default: []
    },

    matchingItems: {
      type: [String],
      default: []
    },

    missingItems: {
      type: [String],
      default: []
    },

    sameWasteLikely: {
      type: Boolean,
      default: false
    },

    separationDetected: {
      type: Boolean,
      default: false
    },

    suspicious: {
      type: Boolean,
      default: false
    },

    reason: {
      type: String,
      default: null
    }
  },
  {
    timestamps: true
  }
);

/*
 * Dashboard query
 */
submissionSchema.index({
  user: 1,
  createdAt: -1
});

/*
 * Exact duplicate protection for before/after pairs.
 *
 * The same user cannot submit the exact same
 * before + after file pair twice.
 */
submissionSchema.index(
  {
    user: 1,
    beforeImageHash: 1,
    afterImageHash: 1
  },
  {
    unique: true,
    partialFilterExpression: {
      beforeImageHash: {
        $type: 'string'
      },
      afterImageHash: {
        $type: 'string'
      }
    }
  }
);

export default mongoose.model('Submission', submissionSchema);