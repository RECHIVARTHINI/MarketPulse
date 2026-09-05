import { Response } from 'express';
import { Types } from 'mongoose';
import { Watchlist } from '../models/Watchlist';
import { resolveQuote, snoozeSymbol, unsnoozeSymbol } from '../services/snapshotService';
import { getLastSeen, markLastSeen } from '../services/snapshotService';
import { getMarketDataProvider } from '../providers/ProviderFactory';
import {
  calculatePriceChange,
  calculateVolatility,
  calculateVolumeAnomaly,
  calculateAttentionScore,
  detectMeaningfulChanges,
  compareWithLastSeenSnapshot,
  generateAttentionDigest,
  ScoredSymbol,
} from '../services/changeEngine';
import { DEFAULT_ATTENTION_BUDGET } from '../config/weights.config';
import { asyncHandler } from '../middleware/asyncHandler';
import { sendSuccess } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import { AuthedRequest } from '../middleware/auth';
import { MarketSnapshot } from '../models/MarketSnapshot';
import { logger } from '../utils/logger';

/**
 * GET /api/watchlists/:id/changes
 *
 * The centerpiece endpoint. For every symbol in the watchlist:
 *   1. Resolve the current live/cached quote (resilient - see snapshotService).
 *   2. Diff it against what the user last saw (compareWithLastSeenSnapshot).
 *   3. Score it with the explainable Attention Score (including streak & freshness).
 *   4. Check active snooze state (snoozed symbols don't consume attention budget).
 * Then, across the whole watchlist "cohort" right now:
 *   5. Rank scores relative to each other (detectMeaningfulChanges).
 *   6. Apply the user's Attention Budget.
 *   7. Generate deterministic Attention Digest synthesis.
 * Finally (unless ?commit=false), each viewed symbol's LastSeenSnapshot is
 * updated to *this* moment with streak tracking.
 */
export const getChangesSinceLastVisit = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const { id } = req.params;
  if (!Types.ObjectId.isValid(id)) throw ApiError.badRequest('Invalid watchlist id', 'INVALID_WATCHLIST_ID');

  const watchlist = await Watchlist.findOne({ _id: id, userId: req.userId });
  if (!watchlist) throw ApiError.notFound('Watchlist not found', 'WATCHLIST_NOT_FOUND');

  const commit = req.query.commit !== 'false';
  const now = new Date();

  if (watchlist.symbols.length === 0) {
    return sendSuccess(res, {
      watchlistId: watchlist.id,
      generatedAt: now,
      digestHeadline: 'Your watchlist is empty. Add stocks to start seeing what changed.',
      summary: { highAttention: 0, moderate: 0, unchanged: 0, total: 0, snoozed: 0, attentionBudget: DEFAULT_ATTENTION_BUDGET, surfaced: 0 },
      items: [],
      emptyState: 'EMPTY_WATCHLIST',
    });
  }

  const provider = getMarketDataProvider();

  const perSymbol = await Promise.all(
    watchlist.symbols.map(async (symbol) => {
      const quote = await resolveQuote(symbol);
      const lastSeenDoc = await getLastSeen(req.userId!, watchlist.id, symbol);
      const events = await provider.getEvents(symbol).catch(() => []);

      const priceChange = calculatePriceChange(quote.price, quote.previousClose);
      const volumeAnomaly = calculateVolumeAnomaly(quote.volume, quote.averageVolume);
      const volatility = calculateVolatility(quote.dayHigh, quote.dayLow, quote.previousClose);

      // Check active snooze
      const isMuted = Boolean(lastSeenDoc?.mutedUntil && new Date(lastSeenDoc.mutedUntil) > now);
      const mutedUntil = isMuted ? lastSeenDoc?.mutedUntil : null;

      // Calculate streak relative to last seen visit
      let streakDirection: 'UP' | 'DOWN' | 'FLAT' | null = null;
      let streakCount = 0;
      if (lastSeenDoc && lastSeenDoc.seenPrice > 0) {
        const diff = quote.price - lastSeenDoc.seenPrice;
        streakDirection = diff > 0.001 ? 'UP' : diff < -0.001 ? 'DOWN' : 'FLAT';
        if (streakDirection !== 'FLAT') {
          if (lastSeenDoc.streakDirection === streakDirection) {
            streakCount = (lastSeenDoc.streakCount || 1) + 1;
          } else {
            streakCount = 1;
          }
        }
      }

      const attention = calculateAttentionScore({
        priceChangePercent: priceChange.percent,
        relativePerformancePercent: priceChange.percent - quote.benchmarkChangePercent,
        volumeRatio: volumeAnomaly.ratio,
        volatilityPercent: volatility,
        hasRecentEvent: events.length > 0,
        eventHeadline: events[0]?.headline,
        observedAt: quote.observedAt,
        now,
        freshness: quote.freshness,
        streakCount,
        streakDirection,
      });

      const sinceLastVisit = compareWithLastSeenSnapshot(
        quote.price,
        quote.volume,
        lastSeenDoc ? { seenPrice: lastSeenDoc.seenPrice, seenVolume: lastSeenDoc.seenVolume, seenAt: lastSeenDoc.seenAt } : null
      );

      return {
        symbol,
        quote,
        priceChange,
        volumeAnomaly,
        volatility,
        attention,
        sinceLastVisit,
        events,
        isMuted,
        mutedUntil,
        momentumStreak: { count: streakCount, direction: streakDirection },
      };
    })
  );

  const scored: ScoredSymbol[] = perSymbol.map((p) => ({ symbol: p.symbol, score: p.attention.score }));
  const cohortRanks = detectMeaningfulChanges(scored);
  const rankBySymbol = new Map(cohortRanks.map((r) => [r.symbol, r]));

  const enriched = perSymbol
    .map((p) => ({ ...p, cohort: rankBySymbol.get(p.symbol)! }))
    .sort((a, b) => b.attention.score - a.attention.score);

  const budget = DEFAULT_ATTENTION_BUDGET;
  let activeSurfacedCount = 0;

  const items = enriched.map((e) => {
    const shouldSurface = !e.isMuted && activeSurfacedCount < budget && e.attention.score > 0;
    if (shouldSurface) {
      activeSurfacedCount++;
    }
    return {
      symbol: e.symbol,
      price: e.quote.price,
      priceChange: e.priceChange,
      volumeAnomaly: e.volumeAnomaly,
      volatilityPercent: e.volatility,
      attentionScore: e.attention.score,
      attentionTier: e.attention.tier,
      explanation: e.attention.explanation,
      breakdown: e.attention.breakdown,
      confidence: e.attention.confidence,
      percentileInCohort: e.cohort.percentileInCohort,
      isTopOfCohort: e.cohort.isTopOfCohort,
      freshness: e.quote.freshness,
      freshnessMessage: e.quote.freshnessMessage,
      degraded: e.quote.degraded,
      sinceLastVisit: e.sinceLastVisit,
      events: e.events,
      isMuted: e.isMuted,
      mutedUntil: e.mutedUntil,
      momentumStreak: e.momentumStreak,
      withinAttentionBudget: shouldSurface,
    };
  });

  const summary = {
    total: items.length,
    highAttention: items.filter((i) => !i.isMuted && i.attentionTier === 'High Attention').length,
    moderate: items.filter((i) => !i.isMuted && (i.attentionTier === 'Important' || i.attentionTier === 'Mild')).length,
    unchanged: items.filter((i) => !i.isMuted && i.attentionTier === 'Normal').length,
    snoozed: items.filter((i) => i.isMuted).length,
    attentionBudget: budget,
    surfaced: items.filter((i) => i.withinAttentionBudget).length,
  };

  const digestHeadline = generateAttentionDigest(items);

  if (commit) {
    await Promise.all(
      perSymbol.map(async (p) => {
        const latestSnapshotDoc = await MarketSnapshot.findOne({ symbol: p.symbol }).sort({ observedAt: -1 });
        if (!latestSnapshotDoc) {
          logger.warn('changes.commit_skipped_no_snapshot', { symbol: p.symbol });
          return;
        }
        await markLastSeen(
          req.userId!,
          watchlist.id,
          p.symbol,
          { price: p.quote.price, volume: p.quote.volume },
          latestSnapshotDoc._id,
          now
        );
      })
    );
  }

  return sendSuccess(res, {
    watchlistId: watchlist.id,
    generatedAt: now,
    committed: commit,
    digestHeadline,
    summary,
    items,
    emptyState: items.every((i) => i.attentionScore === 0) ? 'NOTHING_MEANINGFUL_CHANGED' : null,
  });
});

/**
 * POST /api/watchlists/:id/snooze
 * Snooze a symbol for N hours or until market close.
 */
export const snoozeSymbolController = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const { id } = req.params;
  const { symbol, durationHours, untilMarketClose } = req.body;

  if (!Types.ObjectId.isValid(id)) throw ApiError.badRequest('Invalid watchlist id', 'INVALID_WATCHLIST_ID');
  if (!symbol || typeof symbol !== 'string') throw ApiError.badRequest('Symbol is required', 'MISSING_SYMBOL');

  const watchlist = await Watchlist.findOne({ _id: id, userId: req.userId });
  if (!watchlist) throw ApiError.notFound('Watchlist not found', 'WATCHLIST_NOT_FOUND');

  const now = new Date();
  let mutedUntil = new Date(now.getTime() + (durationHours || 4) * 60 * 60 * 1000);

  if (untilMarketClose) {
    const marketClose = new Date();
    marketClose.setHours(15, 30, 0, 0); // 3:30 PM
    if (marketClose.getTime() <= now.getTime()) {
      marketClose.setDate(marketClose.getDate() + 1);
    }
    mutedUntil = marketClose;
  }

  const updated = await snoozeSymbol(req.userId!, watchlist.id, symbol, mutedUntil);
  return sendSuccess(res, {
    symbol: symbol.toUpperCase(),
    watchlistId: watchlist.id,
    mutedUntil: updated.mutedUntil,
    message: `${symbol.toUpperCase()} snoozed until ${mutedUntil.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
  });
});

/**
 * POST /api/watchlists/:id/unsnooze
 * Unsnooze a symbol immediately.
 */
export const unsnoozeSymbolController = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const { id } = req.params;
  const { symbol } = req.body;

  if (!Types.ObjectId.isValid(id)) throw ApiError.badRequest('Invalid watchlist id', 'INVALID_WATCHLIST_ID');
  if (!symbol || typeof symbol !== 'string') throw ApiError.badRequest('Symbol is required', 'MISSING_SYMBOL');

  const watchlist = await Watchlist.findOne({ _id: id, userId: req.userId });
  if (!watchlist) throw ApiError.notFound('Watchlist not found', 'WATCHLIST_NOT_FOUND');

  await unsnoozeSymbol(req.userId!, watchlist.id, symbol);
  return sendSuccess(res, {
    symbol: symbol.toUpperCase(),
    watchlistId: watchlist.id,
    unmuted: true,
    message: `${symbol.toUpperCase()} un-snoozed`,
  });
});

/**
 * GET /api/watchlists/priority
 * Cross-watchlist "Today's #1 priority" (Feature 4).
 * Evaluates all user watchlists and finds the stock deserving the most attention today.
 */
export const getCrossWatchlistPriorityController = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const watchlists = await Watchlist.find({ userId: req.userId });
  if (!watchlists || watchlists.length === 0) {
    return sendSuccess(res, { priorityStock: null, totalWatchlists: 0, totalSymbols: 0 });
  }

  const symbolMap = new Map<string, { symbol: string; watchlistId: string; watchlistName: string }>();
  watchlists.forEach((wl) => {
    wl.symbols.forEach((s) => {
      if (!symbolMap.has(s.toUpperCase())) {
        symbolMap.set(s.toUpperCase(), { symbol: s.toUpperCase(), watchlistId: wl.id, watchlistName: wl.name });
      }
    });
  });

  const symbols = Array.from(symbolMap.values());
  if (symbols.length === 0) {
    return sendSuccess(res, { priorityStock: null, totalWatchlists: watchlists.length, totalSymbols: 0 });
  }

  const provider = getMarketDataProvider();
  const now = new Date();

  const scoredStocks = await Promise.all(
    symbols.map(async ({ symbol, watchlistId, watchlistName }) => {
      try {
        const quote = await resolveQuote(symbol);
        const lastSeenDoc = await getLastSeen(req.userId!, watchlistId, symbol);
        const events = await provider.getEvents(symbol).catch(() => []);

        const priceChange = calculatePriceChange(quote.price, quote.previousClose);
        const volumeAnomaly = calculateVolumeAnomaly(quote.volume, quote.averageVolume);
        const volatility = calculateVolatility(quote.dayHigh, quote.dayLow, quote.previousClose);

        let streakDirection: 'UP' | 'DOWN' | 'FLAT' | null = null;
        let streakCount = 0;
        if (lastSeenDoc && lastSeenDoc.seenPrice > 0) {
          const diff = quote.price - lastSeenDoc.seenPrice;
          streakDirection = diff > 0.001 ? 'UP' : diff < -0.001 ? 'DOWN' : 'FLAT';
          if (streakDirection !== 'FLAT' && lastSeenDoc.streakDirection === streakDirection) {
            streakCount = (lastSeenDoc.streakCount || 1) + 1;
          }
        }

        const attention = calculateAttentionScore({
          priceChangePercent: priceChange.percent,
          relativePerformancePercent: priceChange.percent - quote.benchmarkChangePercent,
          volumeRatio: volumeAnomaly.ratio,
          volatilityPercent: volatility,
          hasRecentEvent: events.length > 0,
          eventHeadline: events[0]?.headline,
          observedAt: quote.observedAt,
          now,
          freshness: quote.freshness,
          streakCount,
          streakDirection,
        });

        return {
          symbol,
          watchlistId,
          watchlistName,
          price: quote.price,
          priceChange,
          volumeAnomaly,
          attentionScore: attention.score,
          attentionTier: attention.tier,
          breakdown: attention.breakdown,
          explanation: attention.explanation,
          confidence: attention.confidence,
          freshness: quote.freshness,
          events,
          streakCount,
        };
      } catch {
        return null;
      }
    })
  );

  const valid = scoredStocks.filter(Boolean).sort((a, b) => b!.attentionScore - a!.attentionScore);
  const priorityStock = valid.length > 0 && valid[0]!.attentionScore > 0 ? valid[0] : null;

  return sendSuccess(res, {
    priorityStock,
    totalWatchlists: watchlists.length,
    totalSymbols: symbols.length,
  });
});
