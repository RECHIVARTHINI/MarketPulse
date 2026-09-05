import { getMarketDataProvider } from '../providers/ProviderFactory';
import { ProviderError, RawQuote } from '../providers/MarketDataProvider';
import { MarketSnapshot, IMarketSnapshot, FreshnessStatus } from '../models/MarketSnapshot';
import { LastSeenSnapshot, ILastSeenSnapshot } from '../models/LastSeenSnapshot';
import { classifyFreshness, isConflicting } from './freshnessService';
import { cacheService } from './cacheService';
import { logger } from '../utils/logger';
import { Types } from 'mongoose';

const QUOTE_CACHE_TTL_SECONDS = 30;

export interface ResolvedQuote {
  symbol: string;
  price: number;
  previousClose: number;
  dayHigh: number;
  dayLow: number;
  volume: number;
  averageVolume: number;
  benchmarkChangePercent: number;
  observedAt: Date;
  fetchedAt: Date;
  source: 'mock' | 'real' | 'cache';
  freshness: FreshnessStatus;
  freshnessMessage: string;
  degraded: boolean; // true if this is a fallback (cache) rather than a live provider call
}

/**
 * Resolves the best available quote for a symbol, in this order:
 *   1. Ask the live provider (mock or real, per config).
 *   2. On any provider failure (timeout, rate limit, malformed payload),
 *      fall back to the most recent cached/persisted snapshot and mark it
 *      STALE/UNAVAILABLE based on its own age - we NEVER fabricate a fresh
 *      timestamp for old data.
 *   3. If there is truly nothing (first-ever request and provider is down),
 *      surface a clear UNAVAILABLE result rather than throwing past the
 *      caller into a 500.
 * Every successful live fetch is persisted as an immutable MarketSnapshot
 * and cached for QUOTE_CACHE_TTL_SECONDS to avoid hammering the provider.
 */
export async function resolveQuote(symbol: string): Promise<ResolvedQuote> {
  const sym = symbol.toUpperCase();
  const now = new Date();
  const provider = getMarketDataProvider();

  const cacheKey = `quote:${provider.name}:${sym}`;

  try {
    const raw = await provider.getQuote(sym);
    const conflicting = isConflicting(raw.price, raw.dayHigh, raw.dayLow);
    if (conflicting) {
      logger.warn('snapshot.conflicting_data', { symbol: sym, raw });
    }

    const freshness = classifyFreshness(raw.observedAt, now);

    const persisted = await persistSnapshot(raw, conflicting ? 'mock' : provider.name, freshness.status);
    await cacheService.set(cacheKey, serializeForCache(persisted), QUOTE_CACHE_TTL_SECONDS);

    return toResolvedQuote(persisted, freshness.message, false);
  } catch (err) {
    const reason = err instanceof ProviderError ? err.kind : 'UNKNOWN';
    logger.warn('snapshot.provider_failed_falling_back', { symbol: sym, reason, error: (err as Error).message });

    // Fallback 1: short-lived cache from a very recent successful fetch.
    const cached = await cacheService.get<ReturnType<typeof serializeForCache>>(cacheKey);
    if (cached) {
      const observedAt = new Date(cached.observedAt);
      const freshness = classifyFreshness(observedAt, now);
      return {
        ...cached,
        observedAt,
        fetchedAt: new Date(cached.fetchedAt),
        source: 'cache',
        freshness: freshness.status,
        freshnessMessage: freshness.message,
        degraded: true,
      };
    }

    // Fallback 2: last persisted snapshot in the database, however old.
    const last = await MarketSnapshot.findOne({ symbol: sym }).sort({ observedAt: -1 }).lean();
    if (last) {
      const freshness = classifyFreshness(last.observedAt, now);
      return toResolvedQuote(last as unknown as IMarketSnapshot, freshness.message, true);
    }

    // Fallback 3: genuinely nothing available (first-ever request + provider down).
    return {
      symbol: sym,
      price: 0,
      previousClose: 0,
      dayHigh: 0,
      dayLow: 0,
      volume: 0,
      averageVolume: 0,
      benchmarkChangePercent: 0,
      observedAt: now,
      fetchedAt: now,
      source: 'cache',
      freshness: 'UNAVAILABLE',
      freshnessMessage: 'Market data is currently unavailable for this symbol.',
      degraded: true,
    };
  }
}

async function persistSnapshot(
  raw: RawQuote,
  source: 'mock' | 'real',
  freshness: FreshnessStatus
): Promise<IMarketSnapshot> {
  return MarketSnapshot.create({
    symbol: raw.symbol,
    price: raw.price,
    previousClose: raw.previousClose,
    dayHigh: raw.dayHigh,
    dayLow: raw.dayLow,
    volume: raw.volume,
    averageVolume: raw.averageVolume,
    benchmarkChangePercent: raw.benchmarkChangePercent,
    observedAt: raw.observedAt,
    fetchedAt: new Date(),
    source,
    freshness,
  });
}

function serializeForCache(s: IMarketSnapshot) {
  return {
    symbol: s.symbol,
    price: s.price,
    previousClose: s.previousClose,
    dayHigh: s.dayHigh,
    dayLow: s.dayLow,
    volume: s.volume,
    averageVolume: s.averageVolume,
    benchmarkChangePercent: s.benchmarkChangePercent,
    observedAt: s.observedAt,
    fetchedAt: s.fetchedAt,
  };
}

function toResolvedQuote(s: IMarketSnapshot, freshnessMessage: string, degraded: boolean): ResolvedQuote {
  return {
    symbol: s.symbol,
    price: s.price,
    previousClose: s.previousClose,
    dayHigh: s.dayHigh,
    dayLow: s.dayLow,
    volume: s.volume,
    averageVolume: s.averageVolume,
    benchmarkChangePercent: s.benchmarkChangePercent,
    observedAt: s.observedAt,
    fetchedAt: s.fetchedAt,
    source: degraded ? 'cache' : s.source,
    freshness: classifyFreshness(s.observedAt).status,
    freshnessMessage,
    degraded,
  };
}

/** Returns the frozen "what the user last saw" record, or null for a first-time view. */
export async function getLastSeen(
  userId: string,
  watchlistId: string,
  symbol: string
): Promise<ILastSeenSnapshot | null> {
  return LastSeenSnapshot.findOne({ userId, watchlistId, symbol: symbol.toUpperCase() });
}

/**
 * Idempotent upsert: calling this twice with the same (user, watchlist,
 * symbol) simply overwrites the same row, updating seen price/volume,
 * tracking consecutive directional streak count, and preserving any active snooze.
 */
export async function markLastSeen(
  userId: string,
  watchlistId: string,
  symbol: string,
  quote: { price: number; volume: number },
  marketSnapshotId: Types.ObjectId,
  seenAt: Date = new Date()
): Promise<void> {
  const sym = symbol.toUpperCase();
  const existing = await LastSeenSnapshot.findOne({ userId, watchlistId, symbol: sym });

  let streakDirection: 'UP' | 'DOWN' | 'FLAT' | null = null;
  let streakCount = 0;

  if (existing && existing.seenPrice > 0) {
    const diff = quote.price - existing.seenPrice;
    streakDirection = diff > 0.001 ? 'UP' : diff < -0.001 ? 'DOWN' : 'FLAT';

    if (streakDirection !== 'FLAT') {
      if (existing.streakDirection === streakDirection) {
        streakCount = (existing.streakCount || 1) + 1;
      } else {
        streakCount = 1;
      }
    } else {
      streakCount = 0;
    }
  }

  await LastSeenSnapshot.findOneAndUpdate(
    { userId, watchlistId, symbol: sym },
    {
      $set: {
        seenPrice: quote.price,
        seenVolume: quote.volume,
        seenAt,
        marketSnapshotId,
        ...(streakDirection !== null ? { streakDirection, streakCount } : {}),
      },
    },
    { upsert: true, new: true }
  );
}

/**
 * Snooze a symbol until a given timestamp.
 */
export async function snoozeSymbol(
  userId: string,
  watchlistId: string,
  symbol: string,
  mutedUntil: Date
): Promise<ILastSeenSnapshot> {
  const sym = symbol.toUpperCase();
  return LastSeenSnapshot.findOneAndUpdate(
    { userId, watchlistId, symbol: sym },
    { $set: { mutedUntil } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

/**
 * Unsnooze / un-mute a symbol immediately.
 */
export async function unsnoozeSymbol(
  userId: string,
  watchlistId: string,
  symbol: string
): Promise<ILastSeenSnapshot | null> {
  const sym = symbol.toUpperCase();
  return LastSeenSnapshot.findOneAndUpdate(
    { userId, watchlistId, symbol: sym },
    { $set: { mutedUntil: null } },
    { new: true }
  );
}
