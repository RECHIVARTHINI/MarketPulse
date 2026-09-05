export function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
      <div className="flex items-center justify-between">
        <div className="h-5 w-24 rounded bg-slate-200" />
        <div className="h-5 w-16 rounded bg-slate-200" />
      </div>
      <div className="mt-3 h-7 w-32 rounded bg-slate-200" />
      <div className="mt-4 flex gap-2">
        <div className="h-5 w-24 rounded-full bg-slate-200" />
        <div className="h-5 w-20 rounded-full bg-slate-200" />
      </div>
      <div className="mt-4 h-12 w-full rounded-xl bg-slate-100" />
    </div>
  );
}
