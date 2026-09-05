import { Schema, model, Document } from 'mongoose';

export type MarketEventType = 'earnings' | 'dividend' | 'split' | 'news' | 'guidance' | 'other';

export interface IMarketEvent extends Document {
  symbol: string;
  type: MarketEventType;
  headline: string;
  occurredAt: Date;
  source: string;
  createdAt: Date;
}

const MarketEventSchema = new Schema<IMarketEvent>(
  {
    symbol: { type: String, required: true, uppercase: true, index: true },
    type: { type: String, required: true, enum: ['earnings', 'dividend', 'split', 'news', 'guidance', 'other'] },
    headline: { type: String, required: true },
    occurredAt: { type: Date, required: true, index: true },
    source: { type: String, required: true, default: 'mock-provider' },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

MarketEventSchema.index({ symbol: 1, occurredAt: -1 });

export const MarketEvent = model<IMarketEvent>('MarketEvent', MarketEventSchema);
