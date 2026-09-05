import { Schema, model, Document } from 'mongoose';

// Lightweight reference metadata for a symbol - decoupled from live price data,
// which lives in MarketSnapshot. Keeps "what a stock is" separate from
// "what a stock is doing right now".
export interface IStock extends Document {
  symbol: string;
  name: string;
  exchange: string;
  sector?: string;
  benchmarkSymbol: string; // index used for relative-performance comparisons, e.g. NIFTY50
  createdAt: Date;
  updatedAt: Date;
}

const StockSchema = new Schema<IStock>(
  {
    symbol: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
    name: { type: String, required: true },
    exchange: { type: String, required: true, default: 'NSE' },
    sector: { type: String },
    benchmarkSymbol: { type: String, required: true, default: 'NIFTY50' },
  },
  { timestamps: true }
);

export const Stock = model<IStock>('Stock', StockSchema);
