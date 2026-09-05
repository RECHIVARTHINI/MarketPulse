import { ChangesSummary } from '../types';

export function SummaryBar({ summary }: { summary: ChangesSummary }) {
  const hasSnoozed = Boolean(summary.snoozed && summary.snoozed > 0);

  return (
    <div className={`grid gap-3 ${hasSnoozed ? 'grid-cols-2 sm:grid-cols-5' : 'grid-cols-2 sm:grid-cols-4'}`}>
      <Stat
        label="High Attention"
        value={summary.highAttention}
        tone="text-rose-600"
        badge="Urgent"
        badgeStyle="bg-rose-50 text-rose-700"
      />
      <Stat
        label="Moderate"
        value={summary.moderate}
        tone="text-amber-600"
        badge="Review"
        badgeStyle="bg-amber-50 text-amber-700"
      />
      <Stat
        label="Unchanged"
        value={summary.unchanged}
        tone="text-slate-600"
        badge="Steady"
        badgeStyle="bg-slate-100 text-slate-600"
      />
      {hasSnoozed && (
        <Stat
          label="Snoozed"
          value={summary.snoozed || 0}
          tone="text-slate-500"
          badge="Muted"
          badgeStyle="bg-slate-100 text-slate-500"
        />
      )}
      <Stat
        label={`Surfaced (Budget ${summary.attentionBudget})`}
        value={summary.surfaced}
        tone="text-indigo-600"
        badge="Capped"
        badgeStyle="bg-indigo-50 text-indigo-700"
      />
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
  badge,
  badgeStyle,
}: {
  label: string;
  value: number;
  tone: string;
  badge?: string;
  badgeStyle?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs transition hover:border-slate-300">
      <div className="flex items-center justify-between">
        <div className={`text-2xl font-bold ${tone}`}>{value}</div>
        {badge && (
          <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${badgeStyle}`}>
            {badge}
          </span>
        )}
      </div>
      <div className="mt-1 text-xs font-medium text-slate-500">{label}</div>
    </div>
  );
}
