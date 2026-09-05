import { useState } from 'react';
import { ChangeItem } from '../types';
import { AttentionBadge } from './AttentionBadge';
import { FreshnessTag } from './FreshnessTag';
import { api } from '../api/client';
import { useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';

interface ChangeCardProps {
  item: ChangeItem;
  watchlistId: string;
  onOpen: (symbol: string) => void;
}

export function ChangeCard({ item, watchlistId, onOpen }: ChangeCardProps) {
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const [isSnoozing, setIsSnoozing] = useState(false);
  const qc = useQueryClient();

  const up = item.priceChange.percent >= 0;

  const handleSnooze = async (hours?: number, untilMarketClose?: boolean) => {
    try {
      setIsSnoozing(true);
      await api.snoozeSymbol(watchlistId, item.symbol, hours, untilMarketClose);
      qc.invalidateQueries({ queryKey: ['changes'] });
      qc.invalidateQueries({ queryKey: ['global-priority'] });
      setSnoozeOpen(false);
    } finally {
      setIsSnoozing(false);
    }
  };

  const handleUnsnooze = async () => {
    try {
      setIsSnoozing(true);
      await api.unsnoozeSymbol(watchlistId, item.symbol);
      qc.invalidateQueries({ queryKey: ['changes'] });
      qc.invalidateQueries({ queryKey: ['global-priority'] });
      setSnoozeOpen(false);
    } finally {
      setIsSnoozing(false);
    }
  };

  return (
    <div
      onClick={() => onOpen(item.symbol)}
      className={clsx(
        'group relative w-full text-left rounded-2xl border p-5 transition-all duration-200 cursor-pointer',
        item.isMuted
          ? 'border-dashed border-slate-200 bg-slate-50/70 opacity-75 hover:opacity-100 hover:border-slate-300'
          : item.withinAttentionBudget
          ? 'border-slate-200 bg-white shadow-xs hover:border-indigo-300 hover:shadow-md'
          : 'border-slate-200/80 bg-white/90 shadow-xs opacity-90 hover:opacity-100 hover:border-slate-300'
      )}
    >
      {/* Card Header: Symbol, Snooze trigger, Price, Price Change */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-base font-bold text-slate-900 group-hover:text-indigo-600 transition">
              {item.symbol}
            </span>

            {item.isTopOfCohort && item.attentionScore > 0 && !item.isMuted && (
              <span className="rounded-md bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700">
                Top in Watchlist
              </span>
            )}

            {item.momentumStreak && item.momentumStreak.count >= 2 && !item.isMuted && (
              <span
                className="rounded-md bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 inline-flex items-center gap-0.5"
                title={`${item.momentumStreak.count} consecutive visits moving in the same direction`}
              >
                <span>🔥</span>
                <span>{item.momentumStreak.count}v {item.momentumStreak.direction === 'UP' ? 'rise' : 'drop'}</span>
              </span>
            )}

            {item.isMuted && (
              <span className="rounded-md bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
                Snoozed
              </span>
            )}
          </div>

          <div className="mt-1 text-xl font-bold text-slate-900 tracking-tight">
            ₹{item.price.toLocaleString('en-IN')}
          </div>
        </div>

        <div className="flex flex-col items-end gap-1.5">
          <div className="flex items-center gap-1.5">
            <span
              className={clsx(
                'inline-flex items-center rounded-lg px-2 py-0.5 text-xs font-bold',
                up ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
              )}
            >
              {up ? '+' : ''}
              {item.priceChange.percent.toFixed(2)}%
            </span>

            {/* Snooze button / menu */}
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => setSnoozeOpen(!snoozeOpen)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                title={item.isMuted ? 'Manage snooze' : 'Snooze stock from attention budget'}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>

              {snoozeOpen && (
                <div className="absolute right-0 top-7 z-30 w-44 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
                  <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                    {item.isMuted ? 'Snoozed Symbol' : 'Snooze Symbol'}
                  </div>
                  {item.isMuted ? (
                    <button
                      disabled={isSnoozing}
                      onClick={handleUnsnooze}
                      className="w-full rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold text-indigo-600 hover:bg-indigo-50"
                    >
                      ✓ Un-snooze now
                    </button>
                  ) : (
                    <>
                      <button
                        disabled={isSnoozing}
                        onClick={() => handleSnooze(1)}
                        className="w-full rounded-lg px-2.5 py-1 text-left text-xs text-slate-700 hover:bg-slate-100"
                      >
                        1 hour
                      </button>
                      <button
                        disabled={isSnoozing}
                        onClick={() => handleSnooze(4)}
                        className="w-full rounded-lg px-2.5 py-1 text-left text-xs text-slate-700 hover:bg-slate-100"
                      >
                        4 hours
                      </button>
                      <button
                        disabled={isSnoozing}
                        onClick={() => handleSnooze(undefined, true)}
                        className="w-full rounded-lg px-2.5 py-1 text-left text-xs text-slate-700 hover:bg-slate-100"
                      >
                        Until 3:30 PM (Close)
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          <FreshnessTag freshness={item.freshness} message={item.freshnessMessage} />
        </div>
      </div>

      {/* Badges row */}
      <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
        <AttentionBadge tier={item.attentionTier} score={item.attentionScore} />
        {item.percentileInCohort !== null && (
          <span className="text-[11px] font-medium text-slate-500">
            Top {100 - item.percentileInCohort}% in cohort
          </span>
        )}
      </div>

      {/* Explanation */}
      <p className="mt-2.5 text-xs sm:text-sm leading-relaxed text-slate-600 line-clamp-2">
        {item.explanation}
      </p>

      {/* Since Last Visit footnote */}
      <div className="mt-3 flex items-center justify-between text-[11px] text-slate-600 font-medium">
        {item.sinceLastVisit.hasLastSeen && item.sinceLastVisit.percentDeltaSinceLastSeen !== null ? (
          <span>
            Since last visit:{' '}
            <span className={item.sinceLastVisit.percentDeltaSinceLastSeen >= 0 ? 'text-emerald-700 font-semibold' : 'text-rose-700 font-semibold'}>
              {item.sinceLastVisit.percentDeltaSinceLastSeen >= 0 ? '+' : ''}
              {item.sinceLastVisit.percentDeltaSinceLastSeen.toFixed(1)}%
            </span>
          </span>
        ) : (
          <span>First visit looking at this stock</span>
        )}

        <span className="text-indigo-700 group-hover:underline font-semibold flex items-center gap-0.5">
          Details
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
          </svg>
        </span>
      </div>
    </div>
  );
}
