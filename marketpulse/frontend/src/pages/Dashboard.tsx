import { useState } from 'react';
import { Watchlist } from '../types';
import { useChanges } from '../hooks/useChanges';
import { SummaryBar } from '../components/SummaryBar';
import { ChangeCard } from '../components/ChangeCard';
import { SkeletonCard } from '../components/SkeletonCard';
import { EmptyState } from '../components/EmptyState';
import { StockDetailModal } from '../components/StockDetailModal';
import { AttentionDigest } from '../components/AttentionDigest';
import { GlobalPriorityBanner } from '../components/GlobalPriorityBanner';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

interface DashboardProps {
  watchlist: Watchlist | null;
  onSelectWatchlist?: (watchlistId: string) => void;
}

export function Dashboard({ watchlist, onSelectWatchlist }: DashboardProps) {
  const { data, isLoading, isError, error, refetch } = useChanges(watchlist?._id ?? null);
  const [openSymbol, setOpenSymbol] = useState<string | null>(null);
  const [showAllItems, setShowAllItems] = useState(false);

  if (!watchlist) {
    return (
      <EmptyState
        title="No watchlist selected"
        subtitle="Create your first watchlist in the Manage tab to start seeing what's changed."
      />
    );
  }

  const activeItems = data?.items.filter((i) => !i.isMuted) || [];
  const snoozedItems = data?.items.filter((i) => i.isMuted) || [];
  const surfacedItems = activeItems.filter((i) => i.withinAttentionBudget);
  const remainingItems = activeItems.filter((i) => !i.withinAttentionBudget);

  return (
    <div className="space-y-6 pb-12">
      {/* Top Indices & Market Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 pb-3 text-xs">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 font-medium">
            <span className="text-slate-500">NIFTY 50:</span>
            <span className="font-semibold text-slate-800">24,852.15</span>
            <span className="font-bold text-emerald-600">+0.42%</span>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 font-medium">
            <span className="text-slate-500">SENSEX:</span>
            <span className="font-semibold text-slate-800">81,332.70</span>
            <span className="font-bold text-emerald-600">+0.38%</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Market Active
          </span>
          <span className="text-slate-600">NSE / BSE Live Feeds</span>
        </div>
      </div>

      {/* Dashboard Greeting Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {greeting()}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Comparing live market state against your last visit to <span className="font-semibold text-slate-800">“{watchlist.name}”</span>
          </p>
        </div>

        <button
          onClick={() => refetch()}
          className="self-start sm:self-auto inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:border-slate-300 transition"
        >
          <svg className="h-3.5 w-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh Feed
        </button>
      </div>

      {/* 1. Attention Digest (Feature 1 & Feature 6) */}
      {data && data.items.length > 0 && (
        <AttentionDigest
          headline={data.digestHeadline}
          items={data.items}
          watchlistName={watchlist.name}
        />
      )}

      {/* 2. Cross-Watchlist Today's #1 Priority (Feature 4) */}
      <GlobalPriorityBanner
        onOpenStock={setOpenSymbol}
        onSelectWatchlist={onSelectWatchlist}
        currentWatchlistId={watchlist._id}
      />

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 rounded-2xl bg-slate-200/70 animate-pulse" />
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        </div>
      )}

      {/* Error state */}
      {isError && (
        <EmptyState
          title="Couldn't load market changes"
          subtitle={(error as Error)?.message || 'Something went wrong resolving market snapshot data.'}
          action={
            <button
              onClick={() => refetch()}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-500 transition"
            >
              Retry
            </button>
          }
        />
      )}

      {/* Empty Watchlist */}
      {data && data.emptyState === 'EMPTY_WATCHLIST' && (
        <EmptyState
          title="This watchlist has no stocks"
          subtitle="Add a few symbols in the Manage tab to track meaningful changes since your last visit."
        />
      )}

      {/* Watchlist Content */}
      {data && data.items.length > 0 && (
        <div className="space-y-6">
          {/* Summary Stat Bar */}
          <SummaryBar summary={data.summary} />

          {data.emptyState === 'NOTHING_MEANINGFUL_CHANGED' ? (
            <div className="mt-6">
              <EmptyState
                title="Nothing meaningful changed"
                subtitle="Every stock in this watchlist is behaving normally within typical bands since your last visit — that's valuable peace of mind."
              />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Primary: Within Attention Budget */}
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-slate-900">
                      Top Attention Items
                    </h2>
                    <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-bold text-indigo-700">
                      Budget: {surfacedItems.length}/{data.summary.attentionBudget}
                    </span>
                  </div>
                  <span className="text-xs text-slate-600 font-medium">Ranked by Attention Score</span>
                </div>

                {surfacedItems.length > 0 ? (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {surfacedItems.map((item) => (
                      <ChangeCard
                        key={item.symbol}
                        item={item}
                        watchlistId={watchlist._id}
                        onOpen={setOpenSymbol}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-xs text-slate-500">
                    No active high-attention alerts in this watchlist.
                  </div>
                )}
              </div>

              {/* Secondary: Other Watchlist Items */}
              {remainingItems.length > 0 && (
                <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-800">
                        Other Watchlist Items ({remainingItems.length})
                      </h3>
                      <p className="text-xs text-slate-500">
                        Evaluated and confirmed steady or outside the top attention budget
                      </p>
                    </div>

                    <button
                      onClick={() => setShowAllItems(!showAllItems)}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
                    >
                      {showAllItems ? 'Hide Items' : `Show All (${remainingItems.length})`}
                    </button>
                  </div>

                  {showAllItems && (
                    <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {remainingItems.map((item) => (
                        <ChangeCard
                          key={item.symbol}
                          item={item}
                          watchlistId={watchlist._id}
                          onOpen={setOpenSymbol}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Snoozed Items (Feature 2) */}
              {snoozedItems.length > 0 && (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-base">💤</span>
                      <div>
                        <h3 className="text-sm font-bold text-slate-800">
                          Snoozed Stocks ({snoozedItems.length})
                        </h3>
                        <p className="text-xs text-slate-500">
                          Muted from active attention budget to reduce notification fatigue
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {snoozedItems.map((item) => (
                      <ChangeCard
                        key={item.symbol}
                        item={item}
                        watchlistId={watchlist._id}
                        onOpen={setOpenSymbol}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Stock Detail Modal (Feature 5) */}
      {openSymbol && <StockDetailModal symbol={openSymbol} onClose={() => setOpenSymbol(null)} />}
    </div>
  );
}
