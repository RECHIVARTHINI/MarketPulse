import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { FreshnessTag } from './FreshnessTag';
import { AttentionBadge } from './AttentionBadge';
import { RelativePerformanceChart } from './RelativePerformanceChart';

export function StockDetailModal({ symbol, onClose }: { symbol: string; onClose: () => void }) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['stock-detail', symbol],
    queryFn: () => api.getStockDetail(symbol),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">
              Stock Breakdown & Signals
            </div>
            <h2 className="text-xl font-bold text-slate-900">Why {symbol}?</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {isLoading && (
          <div className="py-12 text-center text-sm font-medium text-slate-500 animate-pulse">
            Loading signals & market data for {symbol}…
          </div>
        )}

        {isError && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 mt-4">
            {(error as Error).message || 'Failed to load stock details.'}
          </div>
        )}

        {data && (
          <div className="mt-5 space-y-6">
            {/* Price & Status Banner */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50 p-4 border border-slate-100">
              <div>
                <div className="text-2xl font-bold text-slate-900">
                  ₹{data.quote.price.toLocaleString('en-IN')}
                </div>
                <div
                  className={`mt-0.5 text-sm font-bold ${
                    data.priceChange.percent >= 0 ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                >
                  {data.priceChange.percent >= 0 ? '+' : ''}
                  {data.priceChange.percent.toFixed(2)}% ({data.priceChange.absolute >= 0 ? '+' : ''}
                  {data.priceChange.absolute.toFixed(2)})
                </div>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <AttentionBadge tier={data.attention.tier} score={data.attention.score} />
                <FreshnessTag freshness={data.quote.freshness} message={data.quote.freshnessMessage} />
              </div>
            </div>

            {/* Score & Confidence Breakdown */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <span className="text-sm font-bold text-slate-900">Explainable Attention Score</span>
                  <div className="text-xs text-slate-500">
                    Confidence: {(data.attention.confidence * 100).toFixed(0)}% ({data.quote.freshness.toLowerCase()} data)
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xl font-bold text-indigo-600">
                    {data.attention.score}
                  </span>
                  <span className="text-xs text-slate-600"> / 100</span>
                </div>
              </div>

              <div className="mt-3">
                <div className="text-xs font-semibold text-slate-700 mb-1.5">Signal Breakdown:</div>
                <ul className="space-y-1.5">
                  {data.attention.breakdown.map((b) => (
                    <li
                      key={b.label}
                      className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-1.5 text-xs"
                    >
                      <div className="space-x-1.5">
                        <span className="font-semibold text-slate-800">{b.label}:</span>
                        <span className="text-slate-600">{b.reason}</span>
                      </div>
                      <span className="font-bold text-indigo-600 shrink-0">+{b.points}</span>
                    </li>
                  ))}
                  {data.attention.breakdown.length === 0 && (
                    <li className="text-xs text-slate-500 italic">
                      No notable signals right now — stock is trading within normal parameters.
                    </li>
                  )}
                </ul>
              </div>

              <p className="mt-3.5 rounded-xl bg-indigo-50/70 p-3 text-xs leading-relaxed text-indigo-950 font-medium">
                💡 <span className="font-semibold">Synthesis:</span> {data.attention.explanation}
              </p>
            </div>

            {/* Relative Performance Mini-Chart (Feature 5) */}
            <RelativePerformanceChart
              symbol={symbol}
              stockChangePercent={data.priceChange.percent}
              benchmarkChangePercent={data.benchmarkChangePercent ?? 0}
              benchmarkName={data.benchmarkName || 'NIFTY 50'}
              history={data.history}
            />

            {/* Key Market Metrics Grid */}
            <div>
              <div className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                Key Market Metrics
              </div>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 text-xs">
                <Field label="Previous Close" value={`₹${data.quote.previousClose.toLocaleString('en-IN')}`} />
                <Field label="Day Range" value={`₹${data.quote.dayLow} – ₹${data.quote.dayHigh}`} />
                <Field label="Volume" value={data.quote.volume.toLocaleString('en-IN')} />
                <Field
                  label="Volume vs Avg"
                  value={`${data.volumeAnomaly.ratio.toFixed(1)}x (${data.volumeAnomaly.isAnomalous ? 'Spike' : 'Normal'})`}
                />
                <Field label="Volatility" value={`${data.volatility.toFixed(1)}%`} />
                <Field label="Data Source" value={data.quote.source.toUpperCase()} />
              </div>
            </div>

            {/* Recent Corporate Events */}
            {data.events && data.events.length > 0 && (
              <div>
                <div className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                  Recent Corporate Events
                </div>
                <ul className="space-y-2">
                  {data.events.map((e, i) => (
                    <li key={i} className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-900">
                      <div className="font-semibold capitalize text-amber-950">{e.type}:</div>
                      <div className="mt-0.5">{e.headline}</div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-2xs">
      <div className="text-[10px] font-medium text-slate-500">{label}</div>
      <div className="mt-0.5 font-semibold text-slate-900">{value}</div>
    </div>
  );
}
