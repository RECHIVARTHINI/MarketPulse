import clsx from 'clsx';
import { Freshness } from '../types';

const STYLES: Record<Freshness, string> = {
  FRESH: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  STALE: 'bg-amber-50 text-amber-700 border-amber-200',
  UNAVAILABLE: 'bg-rose-50 text-rose-700 border-rose-200',
};

const DOT_STYLES: Record<Freshness, string> = {
  FRESH: 'bg-emerald-500',
  STALE: 'bg-amber-500',
  UNAVAILABLE: 'bg-rose-500',
};

export function FreshnessTag({ freshness, message }: { freshness: Freshness; message: string }) {
  return (
    <span
      className={clsx('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition cursor-help', STYLES[freshness])}
      title={message}
    >
      <span className={clsx('h-1.5 w-1.5 rounded-full', DOT_STYLES[freshness])} />
      {freshness === 'FRESH' ? 'Live' : freshness === 'STALE' ? 'Delayed' : 'Unavailable'}
    </span>
  );
}
