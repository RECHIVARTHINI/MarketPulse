import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';

export function DemoControlPanel({ onChanged }: { onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['demo-scenarios'], queryFn: api.listDemoScenarios, enabled: open, retry: false });
  const [symbol, setSymbol] = useState('RELIANCE');
  const [scenario, setScenario] = useState('big_move_high_volume');
  const [status, setStatus] = useState<string | null>(null);

  async function apply() {
    try {
      await api.setDemoScenario(symbol, scenario);
      setStatus(`${symbol} → ${scenario}`);
      qc.invalidateQueries({ queryKey: ['changes'] });
      qc.invalidateQueries({ queryKey: ['global-priority'] });
      onChanged();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Failed');
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-40">
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-lg hover:bg-slate-50 hover:text-indigo-600 transition"
        >
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
          ⚡ Demo Scenarios
        </button>
      )}
      {open && (
        <div className="w-80 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">Simulate Market Condition</span>
            <button onClick={() => setOpen(false)} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
              ✕
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Deterministically trigger market events to test attention scoring, streak calculations, and resilience.
          </p>

          <div className="mt-3.5 space-y-2.5">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Target Stock</label>
              <select
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-900 outline-none focus:border-indigo-600"
              >
                {(data?.availableSymbols || ['RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ITC', 'TATAMOTORS']).map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Simulated Scenario</label>
              <select
                value={scenario}
                onChange={(e) => setScenario(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-900 outline-none focus:border-indigo-600"
              >
                {(data?.scenarios || ['normal', 'big_move', 'big_move_high_volume', 'stale', 'api_failure', 'missing_symbol', 'conflicting']).map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <button
              onClick={apply}
              className="w-full rounded-xl bg-indigo-600 py-2 text-xs font-bold text-white shadow-xs hover:bg-indigo-500 transition"
            >
              Apply Condition
            </button>

            {status && (
              <div className="rounded-lg bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 border border-emerald-200 text-center">
                ✓ Applied: {status}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
