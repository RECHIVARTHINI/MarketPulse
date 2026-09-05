import { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import { HistoricalPoint } from '../types';

interface RelativePerformanceChartProps {
  symbol: string;
  stockChangePercent: number;
  benchmarkChangePercent: number;
  benchmarkName?: string;
  history?: HistoricalPoint[];
}

export function RelativePerformanceChart({
  symbol,
  stockChangePercent,
  benchmarkChangePercent,
  benchmarkName = 'NIFTY 50',
  history = [],
}: RelativePerformanceChartProps) {
  const [timeframe, setTimeframe] = useState<'7D' | '14D' | 'All'>('14D');

  const relativeGap = stockChangePercent - benchmarkChangePercent;
  const isOutperforming = relativeGap >= 0;

  // Build normalized comparison data points
  const chartData = useMemo(() => {
    if (!history || history.length === 0) {
      // Fallback synthetic 7-point curve based on current percentage moves
      const points = 7;
      return Array.from({ length: points }).map((_, idx) => {
        const factor = idx / (points - 1);
        const dayLabel = `T-${points - 1 - idx}d`;
        const stockVal = Number((stockChangePercent * factor).toFixed(2));
        const benchVal = Number((benchmarkChangePercent * factor).toFixed(2));
        return {
          name: idx === points - 1 ? 'Today' : dayLabel,
          [symbol]: stockVal,
          [benchmarkName]: benchVal,
        };
      });
    }

    const count = timeframe === '7D' ? 7 : timeframe === '14D' ? 14 : history.length;
    const slice = history.slice(-count);
    if (slice.length === 0) return [];

    const baseStockPrice = slice[0].close || 1;
    return slice.map((pt, idx) => {
      const date = new Date(pt.timestamp);
      const dateLabel = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
      const stockPct = Number((((pt.close - baseStockPrice) / baseStockPrice) * 100).toFixed(2));
      // Benchmark proportional progress
      const factor = slice.length > 1 ? idx / (slice.length - 1) : 1;
      const benchPct = Number((benchmarkChangePercent * factor).toFixed(2));

      return {
        name: idx === slice.length - 1 ? 'Today' : dateLabel,
        [symbol]: stockPct,
        [benchmarkName]: benchPct,
      };
    });
  }, [history, timeframe, symbol, benchmarkName, stockChangePercent, benchmarkChangePercent]);

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Relative Performance vs {benchmarkName}
          </div>
          <div className="mt-0.5 text-xs text-slate-700">
            <span className="font-semibold text-slate-900">{symbol}</span>{' '}
            {isOutperforming ? (
              <span className="font-semibold text-emerald-600">outperformed</span>
            ) : (
              <span className="font-semibold text-rose-600">underperformed</span>
            )}{' '}
            {benchmarkName} by{' '}
            <span className="font-bold">
              {Math.abs(relativeGap).toFixed(1)}%
            </span>{' '}
            in this period.
          </div>
        </div>

        <div className="flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs">
          {(['7D', '14D', 'All'] as const).map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`rounded-md px-2 py-1 text-[11px] font-medium transition ${
                timeframe === tf
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      <div className="h-44 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10, fill: '#64748B' }}
              tickLine={false}
              axisLine={{ stroke: '#E2E8F0' }}
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#64748B' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v > 0 ? '+' : ''}${v}%`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#FFFFFF',
                borderColor: '#E2E8F0',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                fontSize: '11px',
              }}
              formatter={(value: number) => [`${value > 0 ? '+' : ''}${value}%`]}
            />
            <Legend
              wrapperStyle={{ fontSize: '11px', paddingTop: '4px' }}
              iconType="circle"
              iconSize={8}
            />
            <Line
              type="monotone"
              dataKey={symbol}
              stroke="#00D09C"
              strokeWidth={2.5}
              dot={{ r: 3, fill: '#00D09C' }}
              activeDot={{ r: 5 }}
            />
            <Line
              type="monotone"
              dataKey={benchmarkName}
              stroke="#94A3B8"
              strokeWidth={1.75}
              strokeDasharray="4 4"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
