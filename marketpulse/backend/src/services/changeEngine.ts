import {
  SCORE_WEIGHTS,
  SCORE_MAX,
  ATTENTION_TIERS,
  AttentionTier,
  FRESHNESS_CONFIDENCE,
  MIN_COHORT_SIZE_FOR_RELATIVE_RANKING,
} from '../config/weights.config';
import { FreshnessStatus } from '../models/MarketSnapshot';

/* ------------------------------------------------------------------ *
 * All functions in this file are pure: same input -> same output, no
 * I/O, no Date.now() inside the math. This is deliberate - it's what
 * makes calculateAttentionScore() explainable and unit-testable, and
 * it is exactly what the brief calls out as the most important logic
 * to test. Side effects (persistence, "now", provider calls) live in
 * snapshotService.ts and the controllers, never here.
 * ------------------------------------------------------------------ */

export interface PriceChange {
  absolute: number;
  percent: number;
}

export function calculatePriceChange(currentPrice: number, previousClose: number): PriceChange {
  if (previousClose <= 0) return { absolute: 0, percent: 0 };
  const absolute = round2(currentPrice - previousClose);
  const percent = round2((absolute / previousClose) * 100);
  return { absolute, percent };
}

export interface VolumeAnomaly {
  ratio: number; // volume / averageVolume
  isAnomalous: boolean;
}

export function calculateVolumeAnomaly(volume: number, averageVolume: number): VolumeAnomaly {
  if (averageVolume <= 0) return { ratio: 0, isAnomalous: false };
  const ratio = round2(volume / averageVolume);
  return { ratio, isAnomalous: ratio >= 1.8 };
}

export function calculateVolatility(dayHigh: number, dayLow: number, previousClose: number): number {
  if (previousClose <= 0) return 0;
  return round2(((dayHigh - dayLow) / previousClose) * 100);
}

export function calculateRelativePerformance(stockPercent: number, benchmarkPercent: number): number {
  return round2(stockPercent - benchmarkPercent);
}

/**
 * Recency scoring rewards changes that are *fresh news*, not just large.
 * A 5% move that happened three days ago and has already been digested by
 * the market is less "actionable today" than one from the last hour.
 */
export function calculateRecencyScore(observedAt: Date, now: Date): number {
  const hours = (now.getTime() - observedAt.getTime()) / (1000 * 60 * 60);
  if (hours <= 1) return SCORE_WEIGHTS.recency;
  if (hours <= 6) return Math.round(SCORE_WEIGHTS.recency * 0.6);
  if (hours <= 24) return Math.round(SCORE_WEIGHTS.recency * 0.3);
  return 0;
}

export interface ScoreBreakdownLine {
  label: string;
  points: number;
  reason: string;
}

export interface AttentionScoreInput {
  priceChangePercent: number;
  relativePerformancePercent: number;
  volumeRatio: number;
  volatilityPercent: number;
  hasRecentEvent: boolean;
  eventHeadline?: string;
  observedAt: Date;
  now: Date;
  freshness: FreshnessStatus;
  streakCount?: number;
  streakDirection?: 'UP' | 'DOWN' | 'FLAT' | null;
}

export interface AttentionScoreResult {
  rawScore: number; // 0-100 before freshness confidence is applied
  confidence: number; // 0-1 multiplier from FRESHNESS_CONFIDENCE
  score: number; // rawScore * confidence, rounded - what the UI shows
  tier: AttentionTier;
  breakdown: ScoreBreakdownLine[];
  explanation: string;
}

/**
 * The explainable scoring function. Every point awarded is attached to a
 * plain-English reason, and the final score is discounted by how much we
 * trust the underlying data (see config/weights.config.ts design notes).
 */
export function calculateAttentionScore(input: AttentionScoreInput): AttentionScoreResult {
  const breakdown: ScoreBreakdownLine[] = [];

  const absMovePercent = Math.abs(input.priceChangePercent);
  const pricePoints = clamp(
    Math.round((Math.min(absMovePercent, 10) / 10) * SCORE_WEIGHTS.priceMovement),
    0,
    SCORE_WEIGHTS.priceMovement
  );
  if (pricePoints > 0) {
    breakdown.push({
      label: 'Price movement',
      points: pricePoints,
      reason: `Price moved ${absMovePercent.toFixed(1)}%`,
    });
  }

  const absRelative = Math.abs(input.relativePerformancePercent);
  const relativePoints = clamp(
    Math.round((Math.min(absRelative, 6) / 6) * SCORE_WEIGHTS.relativePerformance),
    0,
    SCORE_WEIGHTS.relativePerformance
  );
  if (relativePoints > 0) {
    const direction = input.relativePerformancePercent >= 0 ? 'outperformed' : 'underperformed';
    breakdown.push({
      label: 'Relative performance',
      points: relativePoints,
      reason: `Stock ${direction} its benchmark by ${absRelative.toFixed(1)}%`,
    });
  }

  const volumePoints = clamp(
    Math.round((Math.min(Math.max(input.volumeRatio - 1, 0), 3) / 3) * SCORE_WEIGHTS.volumeAnomaly),
    0,
    SCORE_WEIGHTS.volumeAnomaly
  );
  if (volumePoints > 0) {
    breakdown.push({
      label: 'Volume anomaly',
      points: volumePoints,
      reason: `Volume is ${input.volumeRatio.toFixed(1)}x normal`,
    });
  }

  const volatilityPoints = clamp(
    Math.round((Math.min(input.volatilityPercent, 8) / 8) * SCORE_WEIGHTS.volatility),
    0,
    SCORE_WEIGHTS.volatility
  );
  if (volatilityPoints > 0) {
    breakdown.push({
      label: 'Volatility',
      points: volatilityPoints,
      reason: `Intraday range was ${input.volatilityPercent.toFixed(1)}% of previous close`,
    });
  }

  const eventPoints = input.hasRecentEvent ? SCORE_WEIGHTS.corporateEvent : 0;
  if (eventPoints > 0) {
    breakdown.push({
      label: 'Corporate event',
      points: eventPoints,
      reason: input.eventHeadline ? input.eventHeadline : 'Recent event detected',
    });
  }

  const recencyPoints = calculateRecencyScore(input.observedAt, input.now);
  if (recencyPoints > 0) {
    breakdown.push({ label: 'Recency', points: recencyPoints, reason: 'Change is recent' });
  }

  let streakPoints = 0;
  if (input.streakCount && input.streakCount >= 2 && input.streakDirection && input.streakDirection !== 'FLAT') {
    streakPoints = clamp(
      Math.round((Math.min(input.streakCount - 1, 2) / 2) * SCORE_WEIGHTS.momentumStreak),
      1,
      SCORE_WEIGHTS.momentumStreak
    );
    const directionWord = input.streakDirection === 'UP' ? 'increased' : 'declined';
    breakdown.push({
      label: 'Momentum streak',
      points: streakPoints,
      reason: `Stock has ${directionWord} for ${input.streakCount} consecutive user visits`,
    });
  }

  const rawScore = clamp(
    pricePoints + relativePoints + volumePoints + volatilityPoints + eventPoints + recencyPoints + streakPoints,
    0,
    SCORE_MAX
  );

  const confidence = FRESHNESS_CONFIDENCE[input.freshness];
  const score = Math.round(rawScore * confidence);

  const tier = classifyTier(score);

  let explanation =
    breakdown.length === 0
      ? 'No notable signals detected - this stock is behaving normally.'
      : `Attention Score: ${score}. ` + breakdown.map((b) => `+${b.points} ${b.reason}`).join('. ') + '.';

  if (confidence < 1 && rawScore > 0) {
    explanation += ` (Discounted from a raw score of ${rawScore} because the underlying data is ${input.freshness.toLowerCase()}.)`;
  }

  return { rawScore, confidence, score, tier, breakdown, explanation };
}

export interface DigestItem {
  symbol: string;
  priceChange: PriceChange;
  volumeAnomaly: VolumeAnomaly;
  attentionScore: number;
  attentionTier: AttentionTier;
  events?: Array<{ headline: string }>;
  momentumStreak?: { count: number; direction: 'UP' | 'DOWN' | 'FLAT' | null };
  isMuted?: boolean;
}

/**
 * Deterministic Attention Digest generator (Feature 1).
 * Synthesizes top movers and key drivers into a concise TL;DR headline
 * without non-deterministic LLM calls.
 */
export function generateAttentionDigest(items: DigestItem[]): string {
  const activeItems = items.filter((i) => !i.isMuted);
  if (activeItems.length === 0) {
    return 'Your watchlist is empty. Add stocks to start seeing what changed.';
  }

  const attentionItems = activeItems.filter((i) => i.attentionScore > 20);
  if (attentionItems.length === 0) {
    return `All ${activeItems.length} stocks are steady since your last visit — no urgent anomalies detected.`;
  }

  const top = [...attentionItems].sort((a, b) => b.attentionScore - a.attentionScore)[0];
  const sign = top.priceChange.percent >= 0 ? '+' : '';
  const pctStr = `${sign}${top.priceChange.percent.toFixed(1)}%`;

  const drivers: string[] = [];
  if (top.volumeAnomaly && top.volumeAnomaly.ratio >= 1.8) {
    drivers.push(`on ${top.volumeAnomaly.ratio.toFixed(1)}x volume`);
  }
  if (top.events && top.events.length > 0) {
    const headline = top.events[0].headline.toLowerCase();
    const eventPhrase = headline.includes('quarter') || headline.includes('result') || headline.includes('earn')
      ? 'an earnings release'
      : headline.includes('dividend')
      ? 'a dividend announcement'
      : 'a corporate announcement';
    drivers.push(`after ${eventPhrase}`);
  }
  if (drivers.length === 0 && top.momentumStreak && top.momentumStreak.count >= 2) {
    drivers.push(`extending a ${top.momentumStreak.count}-visit momentum streak`);
  }

  const driverText = drivers.length > 0 ? ` ${drivers.join(' ')}` : '';

  if (attentionItems.length === 1) {
    return `${top.symbol} needs your attention today (${pctStr})${driverText}.`;
  }

  return `${attentionItems.length} stocks need your attention today, led by ${top.symbol} (${pctStr})${driverText}.`;
}

export function classifyTier(score: number): AttentionTier {
  const tier = ATTENTION_TIERS.find((t) => score <= t.max);
  return tier ? tier.label : 'High Attention';
}

export interface ScoredSymbol {
  symbol: string;
  score: number;
}

export interface CohortRankResult {
  symbol: string;
  score: number;
  percentileInCohort: number | null; // null when cohort too small for relative ranking
  isTopOfCohort: boolean;
}

/**
 * Cohort-relative ranking (differentiator #2). Given every scored symbol
 * in a user's watchlist "right now", rank each one against its peers so
 * that "meaningful" adapts to the composition of that specific watchlist
 * instead of a single global threshold. Falls back gracefully to
 * absolute-only ranking for small watchlists where percentiles aren't
 * statistically meaningful.
 */
export function detectMeaningfulChanges(scored: ScoredSymbol[]): CohortRankResult[] {
  if (scored.length === 0) return [];

  const sorted = [...scored].sort((a, b) => a.score - b.score);
  const n = sorted.length;
  const useRelative = n >= MIN_COHORT_SIZE_FOR_RELATIVE_RANKING;

  const rankMap = new Map<string, number>();
  sorted.forEach((s, idx) => {
    // percentile = fraction of cohort this symbol's score is >= to
    const percentile = n === 1 ? 100 : Math.round((idx / (n - 1)) * 100);
    rankMap.set(s.symbol, percentile);
  });

  const maxScore = Math.max(...scored.map((s) => s.score));

  return scored.map((s) => ({
    symbol: s.symbol,
    score: s.score,
    percentileInCohort: useRelative ? rankMap.get(s.symbol) ?? null : null,
    isTopOfCohort: s.score === maxScore && s.score > 0,
  }));
}

export interface LastSeenComparison {
  hasLastSeen: boolean;
  priceDeltaSinceLastSeen: number | null;
  percentDeltaSinceLastSeen: number | null;
  volumeDeltaSinceLastSeen: number | null;
  seenAt: Date | null;
}

/**
 * The core "since your last visit" diff. Compares the live snapshot to the
 * user's frozen LastSeenSnapshot, not to yesterday's close - a
 * first-time user (no LastSeenSnapshot yet) is a fully valid, expected
 * state, not an error.
 */
export function compareWithLastSeenSnapshot(
  currentPrice: number,
  currentVolume: number,
  lastSeen: { seenPrice: number; seenVolume: number; seenAt: Date } | null
): LastSeenComparison {
  if (!lastSeen) {
    return {
      hasLastSeen: false,
      priceDeltaSinceLastSeen: null,
      percentDeltaSinceLastSeen: null,
      volumeDeltaSinceLastSeen: null,
      seenAt: null,
    };
  }

  const priceDelta = round2(currentPrice - lastSeen.seenPrice);
  const percentDelta = lastSeen.seenPrice > 0 ? round2((priceDelta / lastSeen.seenPrice) * 100) : 0;
  const volumeDelta = currentVolume - lastSeen.seenVolume;

  return {
    hasLastSeen: true,
    priceDeltaSinceLastSeen: priceDelta,
    percentDeltaSinceLastSeen: percentDelta,
    volumeDeltaSinceLastSeen: volumeDelta,
    seenAt: lastSeen.seenAt,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}
