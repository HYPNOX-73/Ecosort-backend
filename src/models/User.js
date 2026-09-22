import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },

    passwordHash: {
      type: String,
      required: true
    },

    role: {
      type: String,
      enum: ['user', 'admin', 'collector'],
      default: 'user'
    },

    points: {
      type: Number,
      default: 0
    },

    streak: {
      type: Number,
      default: 0
    },

    longestStreak: {
      type: Number,
      default: 0
    },

    /*
     * Last successful verified submission.
     * Used for daily reward + streak calculation.
     */
    lastVerifiedAt: {
      type: Date,
      default: null
    },

    /*
     * Stores the India calendar date of the last
     * submission that received the daily reward.
     *
     * Example:
     * "2026-09-20"
     */
    lastVerifiedDateKey: {
      type: String,
      default: null
    }
  },
  {
    timestamps: true
  }
);

export default mongoose.model('User', userSchema);