export interface Watchlist {
  _id: string;
  userId: string;
  name: string;
  symbols: string[];
  createdAt: string;
  updatedAt: string;
}

export type Freshness = 'FRESH' | 'STALE' | 'UNAVAILABLE';
export type AttentionTier = 'Normal' | 'Mild' | 'Important' | 'High Attention';

export interface ScoreBreakdownLine {
  label: string;
  points: number;
  reason: string;
}

export interface PriceChange {
  absolute: number;
  percent: number;
}

export interface VolumeAnomaly {
  ratio: number;
  isAnomalous: boolean;
}

export interface SinceLastVisit {
  hasLastSeen: boolean;
  priceDeltaSinceLastSeen: number | null;
  percentDeltaSinceLastSeen: number | null;
  volumeDeltaSinceLastSeen: number | null;
  seenAt: string | null;
}

export interface MarketEventItem {
  symbol: string;
  type: string;
  headline: string;
  occurredAt: string;
}

export interface MomentumStreak {
  count: number;
  direction: 'UP' | 'DOWN' | 'FLAT' | null;
}

export interface ChangeItem {
  symbol: string;
  price: number;
  priceChange: PriceChange;
  volumeAnomaly: VolumeAnomaly;
  volatilityPercent: number;
  attentionScore: number;
  attentionTier: AttentionTier;
  explanation: string;
  breakdown: ScoreBreakdownLine[];
  confidence: number;
  percentileInCohort: number | null;
  isTopOfCohort: boolean;
  freshness: Freshness;
  freshnessMessage: string;
  degraded: boolean;
  sinceLastVisit: SinceLastVisit;
  events: MarketEventItem[];
  isMuted?: boolean;
  mutedUntil?: string | null;
  momentumStreak?: MomentumStreak;
  withinAttentionBudget: boolean;
}

export interface ChangesSummary {
  total: number;
  highAttention: number;
  moderate: number;
  unchanged: number;
  snoozed?: number;
  attentionBudget: number;
  surfaced: number;
}

export interface ChangesResponse {
  watchlistId: string;
  generatedAt: string;
  committed?: boolean;
  digestHeadline?: string;
  summary: ChangesSummary;
  items: ChangeItem[];
  emptyState: 'EMPTY_WATCHLIST' | 'NOTHING_MEANINGFUL_CHANGED' | null;
}

export interface HistoricalPoint {
  timestamp: string;
  close: number;
}

export interface StockDetailResponse {
  symbol: string;
  quote: {
    price: number;
    previousClose: number;
    dayHigh: number;
    dayLow: number;
    volume: number;
    averageVolume: number;
    observedAt: string;
    fetchedAt: string;
    source: string;
    freshness: Freshness;
    freshnessMessage: string;
    degraded: boolean;
  };
  priceChange: PriceChange;
  volumeAnomaly: VolumeAnomaly;
  volatility: number;
  events: MarketEventItem[];
  history?: HistoricalPoint[];
  relativePerformancePercent?: number;
  benchmarkName?: string;
  benchmarkChangePercent?: number;
  attention: {
    rawScore: number;
    confidence: number;
    score: number;
    tier: AttentionTier;
    breakdown: ScoreBreakdownLine[];
    explanation: string;
  };
}

export interface PriorityStockItem {
  symbol: string;
  watchlistId: string;
  watchlistName: string;
  price: number;
  priceChange: PriceChange;
  volumeAnomaly: VolumeAnomaly;
  attentionScore: number;
  attentionTier: AttentionTier;
  breakdown: ScoreBreakdownLine[];
  explanation: string;
  confidence: number;
  freshness: Freshness;
  events: MarketEventItem[];
  streakCount?: number;
}

export interface CrossWatchlistPriorityResponse {
  priorityStock: PriorityStockItem | null;
  totalWatchlists: number;
  totalSymbols: number;
}

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiErrorEnvelope {
  success: false;
  error: { code: string; message: string; details?: unknown };
}
