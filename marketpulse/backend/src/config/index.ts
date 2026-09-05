import dotenv from 'dotenv';
dotenv.config();

function num(name: string, fallback: number): number {
  const v = process.env[name];
  if (v === undefined || v === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function bool(name: string, fallback: boolean): boolean {
  const v = process.env[name];
  if (v === undefined) return fallback;
  return v.toLowerCase() === 'true';
}

export const config = {
  port: num('PORT', 4000),
  nodeEnv: process.env.NODE_ENV || 'development',
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/marketpulse',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  marketProvider: (process.env.MARKET_PROVIDER || 'mock') as 'mock' | 'real',
  realMarketApiKey: process.env.REAL_MARKET_API_KEY || '',
  realMarketApiBaseUrl: process.env.REAL_MARKET_API_BASE_URL || '',
  // Freshness thresholds: anything older than staleThresholdSeconds is STALE,
  // anything older than unavailableThresholdSeconds is treated as UNAVAILABLE.
  staleThresholdSeconds: num('STALE_THRESHOLD_SECONDS', 90),
  unavailableThresholdSeconds: num('UNAVAILABLE_THRESHOLD_SECONDS', 600),
  demoMode: bool('DEMO_MODE', true),
};
