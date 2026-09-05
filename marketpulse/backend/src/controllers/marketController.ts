import { Response } from 'express';
import { z } from 'zod';
import { resolveQuote } from '../services/snapshotService';
import { getMarketDataProvider } from '../providers/ProviderFactory';
import { ProviderError } from '../providers/MarketDataProvider';
import { calculatePriceChange, calculateVolatility, calculateVolumeAnomaly, calculateAttentionScore } from '../services/changeEngine';
import { asyncHandler } from '../middleware/asyncHandler';
import { sendSuccess } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import { AuthedRequest } from '../middleware/auth';
import { MockMarketDataProvider } from '../providers/MockMarketDataProvider';
import { config } from '../config';

const symbolParam = z.string().min(1).max(20);

export const getQuote = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const symbol = symbolParam.parse(req.params.symbol);
  const quote = await resolveQuote(symbol);
  if (quote.price === 0 && quote.freshness === 'UNAVAILABLE') {
    throw ApiError.unavailable(quote.freshnessMessage, 'MARKET_DATA_UNAVAILABLE');
  }
  return sendSuccess(res, quote);
});

export const getHistory = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const symbol = symbolParam.parse(req.params.symbol);
  const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 365);
  const provider = getMarketDataProvider();
  try {
    const points = await provider.getHistoricalData(symbol, days);
    return sendSuccess(res, { symbol: symbol.toUpperCase(), points });
  } catch (err) {
    if (err instanceof ProviderError && err.kind === 'NOT_FOUND') {
      throw ApiError.notFound(`No historical data for ${symbol}`, 'SYMBOL_NOT_FOUND');
    }
    throw ApiError.unavailable('Historical data is temporarily unavailable.', 'MARKET_DATA_UNAVAILABLE');
  }
});

export const getStockDetail = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const symbol = symbolParam.parse(req.params.symbol);
  const provider = getMarketDataProvider();
  const quote = await resolveQuote(symbol);

  if (quote.price === 0 && quote.freshness === 'UNAVAILABLE') {
    throw ApiError.unavailable(quote.freshnessMessage, 'MARKET_DATA_UNAVAILABLE');
  }

  const events = await provider.getEvents(symbol).catch(() => []); // events are non-critical
  const history = await provider.getHistoricalData(symbol, 14).catch(() => []);
  const priceChange = calculatePriceChange(quote.price, quote.previousClose);
  const volumeAnomaly = calculateVolumeAnomaly(quote.volume, quote.averageVolume);
  const volatility = calculateVolatility(quote.dayHigh, quote.dayLow, quote.previousClose);
  const relativePerformancePercent = priceChange.percent - quote.benchmarkChangePercent;

  const scoreResult = calculateAttentionScore({
    priceChangePercent: priceChange.percent,
    relativePerformancePercent,
    volumeRatio: volumeAnomaly.ratio,
    volatilityPercent: volatility,
    hasRecentEvent: events.length > 0,
    eventHeadline: events[0]?.headline,
    observedAt: quote.observedAt,
    now: new Date(),
    freshness: quote.freshness,
  });

  return sendSuccess(res, {
    symbol: quote.symbol,
    quote,
    priceChange,
    volumeAnomaly,
    volatility,
    events,
    history,
    relativePerformancePercent,
    benchmarkName: 'NIFTY 50',
    benchmarkChangePercent: quote.benchmarkChangePercent,
    attention: scoreResult,
  });
});

const scenarioSchema = z.object({
  symbol: z.string().min(1).max(20),
  scenario: z.enum(['normal', 'big_move', 'big_move_high_volume', 'stale', 'api_failure', 'missing_symbol', 'conflicting']),
});

/**
 * Developer/demo-only control to deterministically flip a mock symbol into
 * one of the brief's required demo scenarios (big move, volume spike,
 * provider failure, stale data, etc). Disabled outside demo mode so it can
 * never accidentally ship as a real endpoint.
 */
export const setDemoScenario = asyncHandler(async (req: AuthedRequest, res: Response) => {
  if (!config.demoMode) throw ApiError.notFound('Not found', 'NOT_FOUND');
  const provider = getMarketDataProvider();
  if (!(provider instanceof MockMarketDataProvider)) {
    throw ApiError.badRequest('Demo scenarios only apply to the mock provider.', 'NOT_MOCK_PROVIDER');
  }
  const parsed = scenarioSchema.safeParse(req.body);
  if (!parsed.success) throw ApiError.badRequest('Invalid scenario payload', 'VALIDATION_ERROR', parsed.error.flatten());

  provider.setScenario(parsed.data.symbol, parsed.data.scenario);
  return sendSuccess(res, { symbol: parsed.data.symbol.toUpperCase(), scenario: parsed.data.scenario });
});

export const listDemoScenarios = asyncHandler(async (_req: AuthedRequest, res: Response) => {
  if (!config.demoMode) throw ApiError.notFound('Not found', 'NOT_FOUND');
  return sendSuccess(res, {
    scenarios: ['normal', 'big_move', 'big_move_high_volume', 'stale', 'api_failure', 'missing_symbol', 'conflicting'],
    availableSymbols: ['RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ITC', 'TATAMOTORS'],
  });
});
