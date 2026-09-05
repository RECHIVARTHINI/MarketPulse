import { Schema, model, Document, Types } from 'mongoose';

// This is the heart of the "Since your last visit" model.
// One document per (user, watchlist, symbol): it freezes the exact market
// numbers the user was shown the last time they actually looked at this
// symbol inside this watchlist. The change engine always diffs
// "current live snapshot" against THIS document - never against
// "yesterday's close" - because what matters to a returning user is what
// changed relative to what *they* last saw, on any device.
export interface ILastSeenSnapshot extends Document {
  userId: Types.ObjectId;
  watchlistId: Types.ObjectId;
  symbol: string;
  seenPrice: number;
  seenVolume: number;
  seenAt: Date;
  marketSnapshotId: Types.ObjectId; // pointer to the exact MarketSnapshot the user saw
  mutedUntil?: Date | null;
  streakDirection?: 'UP' | 'DOWN' | 'FLAT' | null;
  streakCount?: number;
  updatedAt: Date;
}

const LastSeenSnapshotSchema = new Schema<ILastSeenSnapshot>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    watchlistId: { type: Schema.Types.ObjectId, ref: 'Watchlist', required: true },
    symbol: { type: String, required: true, uppercase: true },
    seenPrice: { type: Number, required: true },
    seenVolume: { type: Number, required: true },
    seenAt: { type: Date, required: true },
    marketSnapshotId: { type: Schema.Types.ObjectId, ref: 'MarketSnapshot', required: true },
    mutedUntil: { type: Date, default: null },
    streakDirection: { type: String, enum: ['UP', 'DOWN', 'FLAT', null], default: null },
    streakCount: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: false, updatedAt: true } }
);

// One "last seen" record per user+watchlist+symbol. Upserted, never duplicated -
// this is what keeps multi-device access consistent: whichever device the
// user views the dashboard from writes to the same row.
LastSeenSnapshotSchema.index({ userId: 1, watchlistId: 1, symbol: 1 }, { unique: true });

export const LastSeenSnapshot = model<ILastSeenSnapshot>('LastSeenSnapshot', LastSeenSnapshotSchema);
