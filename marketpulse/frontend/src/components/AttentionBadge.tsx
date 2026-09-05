import clsx from 'clsx';
import { AttentionTier } from '../types';

const TIER_STYLES: Record<AttentionTier, string> = {
  Normal: 'bg-slate-100 text-slate-600 border-slate-200',
  Mild: 'bg-sky-50 text-sky-700 border-sky-200',
  Important: 'bg-amber-50 text-amber-800 border-amber-200',
  'High Attention': 'bg-rose-50 text-rose-700 border-rose-200 font-semibold',
};

const TIER_DOT: Record<AttentionTier, string> = {
  Normal: 'bg-slate-400',
  Mild: 'bg-sky-500',
  Important: 'bg-amber-500',
  'High Attention': 'bg-rose-500 animate-pulse',
};

export function AttentionBadge({ tier, score }: { tier: AttentionTier; score: number }) {
  return (
    <span className={clsx('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium', TIER_STYLES[tier])}>
      <span className={clsx('h-1.5 w-1.5 rounded-full', TIER_DOT[tier])} />
      {tier} · {score}
    </span>
  );
}
