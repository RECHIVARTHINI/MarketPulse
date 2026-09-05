import { config } from '../config';
import { FreshnessStatus } from '../models/MarketSnapshot';

export interface FreshnessResult {
  status: FreshnessStatus;
  ageSeconds: number;
  message: string;
}

/**
 * Classifies how much we should trust a market observation, purely based
 * on how old it is relative to "now". This is called every time a quote is
 * about to be shown or scored - freshness is evaluated at read time, not
 * baked into the snapshot at write time, because "now" keeps moving even
 * if the data doesn't.
 */
export function classifyFreshness(observedAt: Date, now: Date = new Date()): FreshnessResult {
  const ageSeconds = Math.max(0, Math.round((now.getTime() - observedAt.getTime()) / 1000));

  if (ageSeconds > config.unavailableThresholdSeconds) {
    return {
      status: 'UNAVAILABLE',
      ageSeconds,
      message: `No usable data - last observation is ${humanizeAge(ageSeconds)} old.`,
    };
  }
  if (ageSeconds > config.staleThresholdSeconds) {
    return {
      status: 'STALE',
      ageSeconds,
      message: `Market data delayed - showing cached information from ${humanizeAge(ageSeconds)} ago.`,
    };
  }
  return { status: 'FRESH', ageSeconds, message: 'Live.' };
}

/**
 * Detects internally-inconsistent provider output - e.g. a "last price"
 * that falls outside the day's own high/low band. We don't try to guess
 * which field is right; we just flag it so the caller can decide whether
 * to fall back to cache rather than silently trusting a broken quote.
 */
export function isConflicting(price: number, dayHigh: number, dayLow: number): boolean {
  const EPSILON = 0.01; // tolerate floating point / rounding noise
  return price > dayHigh + EPSILON || price < dayLow - EPSILON;
}

function humanizeAge(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  return `${hours}h`;
}
