import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { AttentionBadge } from './AttentionBadge';
import { FreshnessTag } from './FreshnessTag';

interface GlobalPriorityBannerProps {
  onOpenStock: (symbol: string) => void;
  onSelectWatchlist?: (watchlistId: string) => void;
  currentWatchlistId?: string | null;
}

export function GlobalPriorityBanner({
  onOpenStock,
  onSelectWatchlist,
  currentWatchlistId,
}: GlobalPriorityBannerProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['global-priority'],
    queryFn: () => api.getGlobalPriority(),
    refetchInterval: 60000,
  });

  if (isLoading || !data) return null;

  const { priorityStock } = data;
  if (!priorityStock) return null;

  const up = priorityStock.priceChange.percent >= 0;
  const isDifferentWatchlist =
    currentWatchlistId && priorityStock.watchlistId !== currentWatchlistId;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-r from-white via-indigo-50/20 to-white p-5 shadow-sm transition hover:shadow-md">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white shadow-xs">
              <span className="h-1.5 w-1.5 rounded-full bg-white animate-ping" />
              Today's #1 Priority
            </span>
            <span className="text-xs text-slate-500">Highest attention across all your watchlists</span>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <h3 className="text-xl font-bold text-slate-900 tracking-tight">
              {priorityStock.symbol}
            </h3>
            <span className="text-lg font-semibold text-slate-700">
              ₹{priorityStock.price.toLocaleString('en-IN')}
            </span>
            <span
              className={`inline-flex items-center rounded-lg px-2 py-0.5 text-xs font-bold ${
                up ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
              }`}
            >
              {up ? '+' : ''}
              {priorityStock.priceChange.percent.toFixed(2)}%
            </span>
            <AttentionBadge
              tier={priorityStock.attentionTier}
              score={priorityStock.attentionScore}
            />
            <FreshnessTag
              freshness={priorityStock.freshness}
              message="Market data status"
            />
          </div>

          <p className="text-xs text-slate-500 line-clamp-1 pt-0.5">
            {priorityStock.explanation}{' '}
            <span className="font-medium text-slate-700">
              (in watchlist: {priorityStock.watchlistName})
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isDifferentWatchlist && onSelectWatchlist && (
            <button
              onClick={() => onSelectWatchlist(priorityStock.watchlistId)}
              className="rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 py-2 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100"
            >
              Go to {priorityStock.watchlistName}
            </button>
          )}
          <button
            onClick={() => onOpenStock(priorityStock.symbol)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-indigo-500 shadow-sm"
          >
            <span>Why this stock?</span>
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
