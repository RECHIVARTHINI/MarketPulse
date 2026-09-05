import { Schema, model, Document, Types } from 'mongoose';

export interface IWatchlist extends Document {
  userId: Types.ObjectId;
  name: string;
  symbols: string[]; // uppercase, deduplicated symbols
  createdAt: Date;
  updatedAt: Date;
}

const WatchlistSchema = new Schema<IWatchlist>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    symbols: {
      type: [String],
      default: [],
      set: (arr: string[]) => Array.from(new Set(arr.map((s) => s.trim().toUpperCase()))),
    },
  },
  { timestamps: true }
);

// A user should not be able to create two watchlists with the identical name.
WatchlistSchema.index({ userId: 1, name: 1 }, { unique: true });

export const Watchlist = model<IWatchlist>('Watchlist', WatchlistSchema);
