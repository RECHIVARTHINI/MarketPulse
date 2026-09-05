import { MarketDataProvider, RawQuote, RawEvent, HistoricalPoint, ProviderError } from './MarketDataProvider';
import { logger } from '../utils/logger';

/**
 * Live Market Data Provider connecting to real-time NSE (National Stock Exchange)
 * market quotes and NIFTY 50 benchmark metrics via Yahoo Finance API.
 */
export class RealMarketDataProvider implements MarketDataProvider {
  readonly name = 'real' as const;
  private benchmarkCache: { percent: number; fetchedAt: number } | null = null;

  private formatTicker(symbol: string): string[] {
    const sym = symbol.toUpperCase().trim();
    if (sym.startsWith('^') || sym.includes('.')) return [sym];
    return [`${sym}.NS`, `${sym}.BO`, sym];
  }

  private cleanSymbol(ticker: string): string {
    return ticker.replace(/\.(NS|BO)$/i, '').toUpperCase();
  }

  private async fetchNiftyBenchmark(): Promise<number> {
    const now = Date.now();
    if (this.benchmarkCache && now - this.benchmarkCache.fetchedAt < 60000) {
      return this.benchmarkCache.percent;
    }
    try {
      const url = 'https://query1.finance.yahoo.com/v8/finance/chart/%5ENSEI?range=5d&interval=1d';
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
      if (!res.ok) return 0;
      const json: any = await res.json();
      const meta = json?.chart?.result?.[0]?.meta;
      if (meta && meta.regularMarketPrice && meta.chartPreviousClose) {
        const pct = ((meta.regularMarketPrice - meta.chartPreviousClose) / meta.chartPreviousClose) * 100;
        const rounded = Math.round(pct * 100) / 100;
        this.benchmarkCache = { percent: rounded, fetchedAt: now };
        logger.info('[REAL_PROVIDER_BENCHMARK]', {
          ticker: '^NSEI',
          niftyPrice: meta.regularMarketPrice,
          chartPreviousClose: meta.chartPreviousClose,
          benchmarkChangePercent: rounded,
          timestamp: meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toISOString() : 'N/A',
        });
        return rounded;
      }
    } catch (e: any) {
      logger.warn('[REAL_PROVIDER_BENCHMARK_ERROR]', { error: e?.message });
    }
    return 0;
  }

  async getQuote(symbol: string): Promise<RawQuote> {
    const tickers = this.formatTicker(symbol);
    const cleanSym = this.cleanSymbol(symbol);
    const benchmarkChangePercent = await this.fetchNiftyBenchmark();

    let lastError: Error | null = null;
    for (const ticker of tickers) {
      try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=5d&interval=1d`;
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });

        if (res.status === 429) throw new ProviderError('Rate limited by market data provider', 'RATE_LIMIT');
        if (!res.ok) continue;

        const json: any = await res.json();
        const result = json?.chart?.result?.[0];
        if (!result || !result.meta || !result.meta.regularMarketPrice) continue;

        const meta = result.meta;
        const price = meta.regularMarketPrice ?? 0;
        const previousClose = meta.chartPreviousClose || meta.previousClose || price;
        const dayHigh = meta.regularMarketDayHigh || price;
        const dayLow = meta.regularMarketDayLow || price;
        const volume = meta.regularMarketVolume || 0;
        const averageVolume = meta.averageDailyVolume3Month || meta.regularMarketVolume || volume || 1;
        const observedAt = meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000) : new Date();

        logger.info('[REAL_PROVIDER_DEBUG]', {
          provider: 'real',
          requestedTicker: ticker,
          cleanSymbol: cleanSym,
          yahooResponseTimestamp: meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toISOString() : 'N/A',
          price,
          previousClose,
          dayHigh,
          dayLow,
          volume,
          averageVolume,
          benchmarkChangePercent,
          source: 'Yahoo Finance (RealMarketDataProvider)',
          observedAt: observedAt.toISOString(),
        });

        return {
          symbol: cleanSym,
          price,
          previousClose,
          dayHigh,
          dayLow,
          volume,
          averageVolume,
          benchmarkChangePercent,
          observedAt,
        };
      } catch (err) {
        lastError = err as Error;
        logger.warn('[REAL_PROVIDER_FETCH_ERROR]', { ticker, error: (err as Error).message });
        if (err instanceof ProviderError && err.kind === 'RATE_LIMIT') throw err;
      }
    }

    throw new ProviderError(`Symbol ${symbol} not found upstream: ${lastError?.message || ''}`, 'NOT_FOUND');
  }

  async getHistoricalData(symbol: string, days: number): Promise<HistoricalPoint[]> {
    const tickers = this.formatTicker(symbol);
    const range = days <= 7 ? '5d' : days <= 15 ? '1mo' : days <= 30 ? '1mo' : '3mo';

    for (const ticker of tickers) {
      try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=${range}&interval=1d`;
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
        if (!res.ok) continue;

        const json: any = await res.json();
        const result = json?.chart?.result?.[0];
        const timestamps = result?.timestamp || [];
        const quotes = result?.indicators?.quote?.[0]?.close || [];

        const points: HistoricalPoint[] = [];
        for (let i = 0; i < timestamps.length; i++) {
          const close = quotes[i];
          if (typeof close === 'number' && !isNaN(close)) {
            points.push({
              timestamp: new Date(timestamps[i] * 1000),
              close: Math.round(close * 100) / 100,
            });
          }
        }

        if (points.length > 0) return points.slice(-days);
      } catch {
        // continue
      }
    }

    return [];
  }

  async getEvents(symbol: string): Promise<RawEvent[]> {
    return [];
  }
}

export const realMarketDataProvider = new RealMarketDataProvider();
