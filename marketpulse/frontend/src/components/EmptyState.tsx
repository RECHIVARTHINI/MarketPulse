export function EmptyState({ title, subtitle, action }: { title: string; subtitle: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/70 px-6 py-14 text-center shadow-xs">
      <div className="text-base font-semibold text-slate-900">{title}</div>
      <p className="mt-1.5 max-w-md text-xs sm:text-sm text-slate-500">{subtitle}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
