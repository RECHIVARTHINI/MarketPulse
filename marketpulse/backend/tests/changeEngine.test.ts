import {
  calculatePriceChange,
  calculateVolumeAnomaly,
  calculateVolatility,
  calculateRelativePerformance,
  calculateAttentionScore,
  generateAttentionDigest,
  classifyTier,
  detectMeaningfulChanges,
  compareWithLastSeenSnapshot,
} from '../src/services/changeEngine';

describe('calculatePriceChange', () => {
  it('computes absolute and percent change', () => {
    expect(calculatePriceChange(1470, 1400)).toEqual({ absolute: 70, percent: 5 });
  });
  it('handles a price drop', () => {
    const { absolute, percent } = calculatePriceChange(1330, 1400);
    expect(absolute).toBe(-70);
    expect(percent).toBeCloseTo(-5, 5);
  });
  it('guards against a zero previous close instead of dividing by zero', () => {
    expect(calculatePriceChange(100, 0)).toEqual({ absolute: 0, percent: 0 });
  });
});

describe('calculateVolumeAnomaly', () => {
  it('flags volume >= 1.8x average as anomalous', () => {
    expect(calculateVolumeAnomaly(2_000_000, 1_000_000)).toEqual({ ratio: 2, isAnomalous: true });
  });
  it('does not flag normal volume', () => {
    expect(calculateVolumeAnomaly(1_050_000, 1_000_000).isAnomalous).toBe(false);
  });
  it('guards against a zero average volume', () => {
    expect(calculateVolumeAnomaly(1000, 0)).toEqual({ ratio: 0, isAnomalous: false });
  });
});

describe('calculateVolatility', () => {
  it('expresses the day range as a percent of previous close', () => {
    expect(calculateVolatility(110, 90, 100)).toBe(20);
  });
});

describe('calculateRelativePerformance', () => {
  it('returns the outperformance gap versus benchmark', () => {
    expect(calculateRelativePerformance(5, 1.8)).toBeCloseTo(3.2, 5);
  });
});

describe('calculateAttentionScore', () => {
  const baseInput = {
    priceChangePercent: 0.2,
    relativePerformancePercent: 0.1,
    volumeRatio: 1.0,
    volatilityPercent: 0.5,
    hasRecentEvent: false,
    observedAt: new Date('2026-09-04T10:00:00Z'),
    now: new Date('2026-09-04T10:00:30Z'),
    freshness: 'FRESH' as const,
  };

  it('produces a low, Normal-tier score for routine movement', () => {
    const result = calculateAttentionScore(baseInput);
    expect(result.tier).toBe('Normal');
    expect(result.score).toBeLessThanOrEqual(20);
  });

  it('produces a High Attention score for a large move with volume + event', () => {
    const result = calculateAttentionScore({
      ...baseInput,
      priceChangePercent: 8,
      relativePerformancePercent: 5,
      volumeRatio: 3.5,
      volatilityPercent: 7,
      hasRecentEvent: true,
      eventHeadline: 'Reliance reported strong quarterly results',
    });
    expect(result.tier).toBe('High Attention');
    expect(result.score).toBeGreaterThan(75);
    expect(result.breakdown.length).toBeGreaterThan(0);
    expect(result.explanation).toContain('Attention Score');
  });

  it('discounts the score when data is STALE (confidence-adjusted scoring)', () => {
    const freshResult = calculateAttentionScore({ ...baseInput, priceChangePercent: 5, volumeRatio: 2.5, freshness: 'FRESH' });
    const staleResult = calculateAttentionScore({ ...baseInput, priceChangePercent: 5, volumeRatio: 2.5, freshness: 'STALE' });
    expect(staleResult.rawScore).toBe(freshResult.rawScore);
    expect(staleResult.score).toBeLessThan(freshResult.score);
    expect(staleResult.explanation).toMatch(/discounted/i);
  });

  it('returns a zero score for UNAVAILABLE data regardless of raw signals', () => {
    const result = calculateAttentionScore({ ...baseInput, priceChangePercent: 8, volumeRatio: 4, freshness: 'UNAVAILABLE' });
    expect(result.score).toBe(0);
  });

  it('caps the score at 100 even with extreme inputs', () => {
    const result = calculateAttentionScore({
      priceChangePercent: 50,
      relativePerformancePercent: 40,
      volumeRatio: 20,
      volatilityPercent: 50,
      hasRecentEvent: true,
      observedAt: new Date('2026-09-04T10:00:00Z'),
      now: new Date('2026-09-04T10:00:00Z'),
      freshness: 'FRESH',
    });
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it('awards momentum streak points for consecutive visit movements', () => {
    const withoutStreak = calculateAttentionScore({ ...baseInput, priceChangePercent: 3 });
    const withStreak = calculateAttentionScore({
      ...baseInput,
      priceChangePercent: 3,
      streakCount: 3,
      streakDirection: 'UP',
    });
    expect(withStreak.score).toBeGreaterThan(withoutStreak.score);
    const streakLine = withStreak.breakdown.find((b) => b.label === 'Momentum streak');
    expect(streakLine).toBeDefined();
    expect(streakLine?.reason).toContain('3 consecutive user visits');
  });
});

describe('generateAttentionDigest (deterministic synthesis)', () => {
  it('returns steady message when no stock has high attention', () => {
    const items = [
      {
        symbol: 'TCS',
        priceChange: { absolute: 5, percent: 0.2 },
        volumeAnomaly: { ratio: 1.0, isAnomalous: false },
        attentionScore: 10,
        attentionTier: 'Normal' as const,
      },
      {
        symbol: 'INFY',
        priceChange: { absolute: 2, percent: 0.1 },
        volumeAnomaly: { ratio: 0.9, isAnomalous: false },
        attentionScore: 8,
        attentionTier: 'Normal' as const,
      },
    ];
    const digest = generateAttentionDigest(items);
    expect(digest).toContain('All 2 stocks are steady');
  });

  it('synthesizes top movers and drivers accurately for multiple stocks', () => {
    const items = [
      {
        symbol: 'RELIANCE',
        priceChange: { absolute: 70, percent: 5.2 },
        volumeAnomaly: { ratio: 2.7, isAnomalous: true },
        attentionScore: 91,
        attentionTier: 'High Attention' as const,
        events: [{ headline: 'Quarterly results ahead of consensus' }],
      },
      {
        symbol: 'TCS',
        priceChange: { absolute: 120, percent: 3.1 },
        volumeAnomaly: { ratio: 1.2, isAnomalous: false },
        attentionScore: 60,
        attentionTier: 'Important' as const,
      },
    ];
    const digest = generateAttentionDigest(items);
    expect(digest).toContain('2 stocks need your attention today, led by RELIANCE (+5.2%)');
    expect(digest).toContain('2.7x volume');
    expect(digest).toContain('earnings release');
  });

  it('handles a single stock needing attention with momentum streak', () => {
    const items = [
      {
        symbol: 'HDFCBANK',
        priceChange: { absolute: 40, percent: 2.5 },
        volumeAnomaly: { ratio: 1.1, isAnomalous: false },
        attentionScore: 55,
        attentionTier: 'Important' as const,
        momentumStreak: { count: 3, direction: 'UP' as const },
      },
    ];
    const digest = generateAttentionDigest(items);
    expect(digest).toContain('HDFCBANK needs your attention today (+2.5%)');
    expect(digest).toContain('3-visit momentum streak');
  });
});

describe('classifyTier', () => {
  it.each([
    [0, 'Normal'],
    [20, 'Normal'],
    [21, 'Mild'],
    [50, 'Mild'],
    [51, 'Important'],
    [75, 'Important'],
    [76, 'High Attention'],
    [100, 'High Attention'],
  ])('classifies score %i as %s', (score, expected) => {
    expect(classifyTier(score)).toBe(expected);
  });
});

describe('detectMeaningfulChanges (cohort-relative ranking)', () => {
  it('returns null percentile for cohorts below the minimum size', () => {
    const result = detectMeaningfulChanges([
      { symbol: 'A', score: 10 },
      { symbol: 'B', score: 90 },
    ]);
    expect(result.every((r) => r.percentileInCohort === null)).toBe(true);
  });

  it('ranks by percentile once the cohort is large enough', () => {
    const result = detectMeaningfulChanges([
      { symbol: 'A', score: 5 },
      { symbol: 'B', score: 10 },
      { symbol: 'C', score: 50 },
      { symbol: 'D', score: 90 },
    ]);
    const bySymbol = Object.fromEntries(result.map((r) => [r.symbol, r]));
    expect(bySymbol.D.percentileInCohort).toBe(100);
    expect(bySymbol.A.percentileInCohort).toBe(0);
    expect(bySymbol.D.isTopOfCohort).toBe(true);
    expect(bySymbol.A.isTopOfCohort).toBe(false);
  });

  it('marks nothing as top-of-cohort when every score is zero', () => {
    const result = detectMeaningfulChanges([
      { symbol: 'A', score: 0 },
      { symbol: 'B', score: 0 },
    ]);
    expect(result.every((r) => !r.isTopOfCohort)).toBe(true);
  });

  it('handles an empty cohort', () => {
    expect(detectMeaningfulChanges([])).toEqual([]);
  });
});

describe('compareWithLastSeenSnapshot', () => {
  it('reports hasLastSeen=false for a first-time viewer', () => {
    const result = compareWithLastSeenSnapshot(1470, 1_000_000, null);
    expect(result.hasLastSeen).toBe(false);
    expect(result.priceDeltaSinceLastSeen).toBeNull();
  });

  it('computes deltas against the frozen last-seen snapshot', () => {
    const seenAt = new Date('2026-09-03T09:00:00Z');
    const result = compareWithLastSeenSnapshot(1470, 1_200_000, { seenPrice: 1400, seenVolume: 1_000_000, seenAt });
    expect(result.hasLastSeen).toBe(true);
    expect(result.priceDeltaSinceLastSeen).toBe(70);
    expect(result.percentDeltaSinceLastSeen).toBeCloseTo(5, 5);
    expect(result.volumeDeltaSinceLastSeen).toBe(200_000);
    expect(result.seenAt).toEqual(seenAt);
  });
});
