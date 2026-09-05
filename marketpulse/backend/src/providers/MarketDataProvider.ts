/**
 * Provider abstraction. Nothing outside `providers/` may know whether
 * quotes come from a real API or a deterministic mock - controllers and
 * services only ever talk to this interface (dependency inversion).
 *
 * A raw quote is intentionally "dumb": it reports what the provider saw
 * and how confident we should be in it. It does NOT decide freshness -
 * that is the caller's job (see services/freshnessService.ts), because
 * freshness depends on *when the caller is asking*, not just when the
 * provider last spoke.
 */
export interface RawQuote {
  symbol: string;
  price: number;
  previousClose: number;
  dayHigh: number;
  dayLow: number;
  volume: number;
  averageVolume: number;
  benchmarkChangePercent: number;
  observedAt: Date;
}

export interface RawEvent {
  symbol: string;
  type: 'earnings' | 'dividend' | 'split' | 'news' | 'guidance' | 'other';
  headline: string;
  occurredAt: Date;
}

export interface HistoricalPoint {
  timestamp: Date;
  close: number;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    public kind: 'TIMEOUT' | 'RATE_LIMIT' | 'NOT_FOUND' | 'MALFORMED' | 'UNKNOWN'
  ) {
    super(message);
  }
}

export interface MarketDataProvider {
  readonly name: 'mock' | 'real';
  getQuote(symbol: string): Promise<RawQuote>;
  getHistoricalData(symbol: string, days: number): Promise<HistoricalPoint[]>;
  getEvents(symbol: string): Promise<RawEvent[]>;
}
