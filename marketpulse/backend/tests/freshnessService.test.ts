import { classifyFreshness, isConflicting } from '../src/services/freshnessService';

describe('classifyFreshness', () => {
  const now = new Date('2026-09-04T10:00:00Z');

  it('classifies recent data as FRESH', () => {
    const observedAt = new Date('2026-09-04T09:59:40Z'); // 20s old
    expect(classifyFreshness(observedAt, now).status).toBe('FRESH');
  });

  it('classifies moderately old data as STALE', () => {
    const observedAt = new Date('2026-09-04T09:57:00Z'); // 3 min old
    const result = classifyFreshness(observedAt, now);
    expect(result.status).toBe('STALE');
    expect(result.message).toMatch(/delayed/i);
  });

  it('classifies very old data as UNAVAILABLE', () => {
    const observedAt = new Date('2026-09-04T09:00:00Z'); // 60 min old
    expect(classifyFreshness(observedAt, now).status).toBe('UNAVAILABLE');
  });
});

describe('isConflicting', () => {
  it('flags a price above the day high', () => {
    expect(isConflicting(120, 110, 90)).toBe(true);
  });
  it('flags a price below the day low', () => {
    expect(isConflicting(80, 110, 90)).toBe(true);
  });
  it('does not flag a price within the day range', () => {
    expect(isConflicting(100, 110, 90)).toBe(false);
  });
});
