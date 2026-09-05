import { MarketDataProvider, RawQuote, RawEvent, HistoricalPoint, ProviderError } from './MarketDataProvider';

export type MockScenario =
  | 'normal'
  | 'big_move'
  | 'big_move_high_volume'
  | 'stale'
  | 'api_failure'
  | 'missing_symbol'
  | 'conflicting';

interface BaseProfile {
  base: number;
  prevClose: number;
  avgVolume: number;
}

// Deterministic starting profile per demo symbol so numbers are reproducible
// run-to-run (a hackathon judge should be able to re-run the same demo and
// see the same story every time).
const BASE_PROFILES: Record<string, BaseProfile> = {
  RELIANCE: { base: 1400, prevClose: 1400, avgVolume: 4_200_000 },
  TCS: { base: 3850, prevClose: 3850, avgVolume: 1_100_000 },
  INFY: { base: 1620, prevClose: 1620, avgVolume: 2_400_000 },
  HDFCBANK: { base: 1620, prevClose: 1620, avgVolume: 3_600_000 },
  ITC: { base: 460, prevClose: 460, avgVolume: 5_800_000 },
  TATAMOTORS: { base: 940, prevClose: 940, avgVolume: 6_500_000 },
};

// A tiny seeded PRNG (mulberry32) so "random-looking" mock data is fully
// reproducible - no external randomness, no flakiness in tests or demos.
function seededRandom(seed: number) {
  let t = seed + 0x6d2b79f5;
  return function () {
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSymbol(symbol: string): number {
  let h = 0;
  for (let i = 0; i < symbol.length; i++) h = (h * 31 + symbol.charCodeAt(i)) | 0;
  return h >>> 0;
}

/**
 * Deterministic, dependency-free market data source used for local
 * development and every demo scenario in the brief (large move, volume
 * anomaly, provider failure, stale data, first-time user, etc). Swapping
 * this for RealMarketDataProvider is a one-line config change
 * (MARKET_PROVIDER=real) - nothing else in the app changes.
 */
export class MockMarketDataProvider implements MarketDataProvider {
  readonly name = 'mock' as const;

  // In-memory scenario registry, mutated only via the demo-control endpoint.
  // Not persisted - resets on server restart, which is intentional for a
  // hackathon demo (predictable starting state every run).
  private scenarios = new Map<string, MockScenario>();

  setScenario(symbol: string, scenario: MockScenario) {
    this.scenarios.set(symbol.toUpperCase(), scenario);
  }

  getScenario(symbol: string): MockScenario {
    return this.scenarios.get(symbol.toUpperCase()) || 'normal';
  }

  clearScenarios() {
    this.scenarios.clear();
  }

  async getQuote(symbol: string): Promise<RawQuote> {
    const sym = symbol.toUpperCase();
    const scenario = this.getScenario(sym);

    if (scenario === 'api_failure') {
      throw new ProviderError(`Mock provider simulated failure for ${sym}`, 'TIMEOUT');
    }
    if (scenario === 'missing_symbol' || !BASE_PROFILES[sym]) {
      throw new ProviderError(`Symbol ${sym} not found`, 'NOT_FOUND');
    }

    const profile = BASE_PROFILES[sym];
    const rand = seededRandom(hashSymbol(sym));

    let priceMovePercent = (rand() - 0.5) * 1.2; // ~[-0.6%, 0.6%] "normal" noise
    let volumeMultiplier = 0.8 + rand() * 0.4; // ~[0.8x, 1.2x] "normal" noise
    let observedAt = new Date();

    if (scenario === 'big_move') {
      priceMovePercent = 4.5 + rand() * 1.5; // +4.5% to +6%
      volumeMultiplier = 1.1 + rand() * 0.3;
    } else if (scenario === 'big_move_high_volume') {
      priceMovePercent = -5 - rand() * 2; // -5% to -7% (a drop is just as "meaningful")
      volumeMultiplier = 2.5 + rand() * 1.0; // 2.5x-3.5x average volume
    } else if (scenario === 'stale') {
      // Data hasn't actually moved much, but it's old - freshnessService
      // will classify this as STALE/UNAVAILABLE based on observedAt age.
      priceMovePercent = 0.3;
      observedAt = new Date(Date.now() - 15 * 60 * 1000); // 15 minutes old
    } else if (scenario === 'conflicting') {
      // Deliberately return a price outside the day's high/low band to
      // exercise the conflicting-data guard in freshnessService.
      priceMovePercent = 2.0;
    }

    const price = round2(profile.base * (1 + priceMovePercent / 100));
    const dayHigh = round2(Math.max(price, profile.base) * (scenario === 'conflicting' ? 0.99 : 1.01));
    const dayLow = round2(Math.min(price, profile.base) * (scenario === 'conflicting' ? 1.01 : 0.99));
    const volume = Math.round(profile.avgVolume * volumeMultiplier);
    const benchmarkChangePercent = round2((rand() - 0.5) * 1.0); // NIFTY-style noise, independent of the stock

    return {
      symbol: sym,
      price,
      previousClose: profile.prevClose,
      dayHigh,
      dayLow,
      volume,
      averageVolume: profile.avgVolume,
      benchmarkChangePercent,
      observedAt,
    };
  }

  async getHistoricalData(symbol: string, days: number): Promise<HistoricalPoint[]> {
    const sym = symbol.toUpperCase();
    const profile = BASE_PROFILES[sym];
    if (!profile) throw new ProviderError(`Symbol ${sym} not found`, 'NOT_FOUND');

    const rand = seededRandom(hashSymbol(sym) + 7);
    const points: HistoricalPoint[] = [];
    let price = profile.base * 0.9;
    const now = Date.now();
    for (let i = days; i >= 0; i--) {
      price = price * (1 + (rand() - 0.48) * 0.02);
      points.push({ timestamp: new Date(now - i * 24 * 60 * 60 * 1000), close: round2(price) });
    }
    return points;
  }

  async getEvents(symbol: string): Promise<RawEvent[]> {
    const sym = symbol.toUpperCase();
    const scenario = this.getScenario(sym);
    if (scenario === 'big_move' || scenario === 'big_move_high_volume') {
      return [
        {
          symbol: sym,
          type: 'earnings',
          headline: `${sym} reported quarterly results ahead of consensus estimates`,
          occurredAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        },
      ];
    }
    return [];
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export const mockMarketDataProvider = new MockMarketDataProvider();
