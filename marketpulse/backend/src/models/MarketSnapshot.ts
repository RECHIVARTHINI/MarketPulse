import { Schema, model, Document } from 'mongoose';

export type FreshnessStatus = 'FRESH' | 'STALE' | 'UNAVAILABLE';

// A single point-in-time observation of a symbol's market state.
// This is the append-only "ground truth" ledger: every fetch from a
// provider (real or mock) writes one of these. We never mutate history -
// we only ever add. That gives us a free audit trail and makes
// compareWithLastSeenSnapshot() a pure diff over two immutable documents.
export interface IMarketSnapshot extends Document {
  symbol: string;
  price: number;
  previousClose: number;
  dayHigh: number;
  dayLow: number;
  volume: number;
  averageVolume: number; // trailing baseline, used for volume-anomaly detection
  benchmarkChangePercent: number; // % move of the symbol's benchmark index over the same window
  observedAt: Date; // when the underlying market data point occurred
  fetchedAt: Date; // when our system actually retrieved it
  source: 'mock' | 'real' | 'cache';
  freshness: FreshnessStatus;
}

const MarketSnapshotSchema = new Schema<IMarketSnapshot>(
  {
    symbol: { type: String, required: true, uppercase: true, index: true },
    price: { type: Number, required: true, min: 0 },
    previousClose: { type: Number, required: true, min: 0 },
    dayHigh: { type: Number, required: true, min: 0 },
    dayLow: { type: Number, required: true, min: 0 },
    volume: { type: Number, required: true, min: 0 },
    averageVolume: { type: Number, required: true, min: 0 },
    benchmarkChangePercent: { type: Number, required: true, default: 0 },
    observedAt: { type: Date, required: true },
    fetchedAt: { type: Date, required: true, default: () => new Date() },
    source: { type: String, required: true, enum: ['mock', 'real', 'cache'] },
    freshness: { type: String, required: true, enum: ['FRESH', 'STALE', 'UNAVAILABLE'] },
  },
  { timestamps: false }
);

// Fast "give me the latest snapshot for this symbol" lookups.
MarketSnapshotSchema.index({ symbol: 1, observedAt: -1 });

export const MarketSnapshot = model<IMarketSnapshot>('MarketSnapshot', MarketSnapshotSchema);
