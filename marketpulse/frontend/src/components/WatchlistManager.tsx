import { useState } from 'react';
import { Watchlist } from '../types';
import { useCreateWatchlist, useDeleteWatchlist, useUpdateWatchlist } from '../hooks/useWatchlists';

export function WatchlistManager({
  watchlists,
  activeId,
  onSelect,
}: {
  watchlists: Watchlist[];
  activeId: string | null;
  onSelect: (id: string) => void;
}) {
  const [newName, setNewName] = useState('');
  const [newSymbols, setNewSymbols] = useState('');
  const [addSymbolInput, setAddSymbolInput] = useState('');
  const createMut = useCreateWatchlist();
  const updateMut = useUpdateWatchlist();
  const deleteMut = useDeleteWatchlist();

  const active = watchlists.find((w) => w._id === activeId) || null;

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    const symbols = newSymbols
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    createMut.mutate(
      { name: newName.trim(), symbols },
      {
        onSuccess: (w) => {
          setNewName('');
          setNewSymbols('');
          onSelect(w._id);
        },
      }
    );
  }

  function handleAddSymbol(e: React.FormEvent) {
    e.preventDefault();
    if (!active || !addSymbolInput.trim()) return;
    updateMut.mutate({ id: active._id, patch: { addSymbols: [addSymbolInput.trim().toUpperCase()] } });
    setAddSymbolInput('');
  }

  function handleRemoveSymbol(symbol: string) {
    if (!active) return;
    updateMut.mutate({ id: active._id, patch: { removeSymbols: [symbol] } });
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Create Watchlist Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <h3 className="text-base font-bold text-slate-900">Create a New Watchlist</h3>
        <p className="text-xs text-slate-500 mt-0.5">Group stocks into focused attention baskets.</p>

        <form onSubmit={handleCreate} className="mt-4 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Watchlist Name</label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Core Banking & IT"
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-sm text-slate-900 outline-none focus:border-indigo-600 focus:bg-white transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Initial Stocks (comma separated)</label>
            <input
              value={newSymbols}
              onChange={(e) => setNewSymbols(e.target.value)}
              placeholder="RELIANCE, TCS, INFY, HDFCBANK"
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-sm text-slate-900 outline-none focus:border-indigo-600 focus:bg-white transition"
            />
          </div>

          <button
            type="submit"
            disabled={createMut.isPending || !newName.trim()}
            className="rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-indigo-500 disabled:opacity-50 transition"
          >
            {createMut.isPending ? 'Creating…' : 'Create Watchlist'}
          </button>
          {createMut.isError && <p className="text-xs text-rose-600 font-medium">{(createMut.error as Error).message}</p>}
        </form>

        <div className="mt-8 border-t border-slate-100 pt-6">
          <h3 className="text-sm font-bold text-slate-900">Your Watchlists</h3>
          <ul className="mt-3 space-y-1.5">
            {watchlists.map((w) => (
              <li key={w._id}>
                <button
                  onClick={() => onSelect(w._id)}
                  className={`w-full flex items-center justify-between rounded-xl px-3.5 py-2.5 text-left text-xs font-semibold transition ${
                    w._id === activeId
                      ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-2xs'
                      : 'text-slate-700 border border-slate-100 hover:bg-slate-50'
                  }`}
                >
                  <span>{w.name}</span>
                  <span className="rounded-md bg-white px-2 py-0.5 text-[11px] font-normal text-slate-500 border border-slate-200">
                    {w.symbols.length} stocks
                  </span>
                </button>
              </li>
            ))}
            {watchlists.length === 0 && <li className="text-xs text-slate-500">No watchlists created yet.</li>}
          </ul>
        </div>
      </div>

      {/* Manage Selected Watchlist Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <h3 className="text-base font-bold text-slate-900">
          Manage Stocks {active ? `— “${active.name}”` : ''}
        </h3>
        {!active && <p className="mt-3 text-xs text-slate-500">Select a watchlist on the left to edit its symbols.</p>}
        {active && (
          <>
            <p className="text-xs text-slate-500 mt-0.5">Add or remove stocks tracked in this attention cohort.</p>

            <form onSubmit={handleAddSymbol} className="mt-4 flex gap-2">
              <input
                value={addSymbolInput}
                onChange={(e) => setAddSymbolInput(e.target.value)}
                placeholder="Add stock symbol (e.g. TATAMOTORS)"
                className="flex-1 rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-sm text-slate-900 outline-none focus:border-indigo-600 focus:bg-white transition"
              />
              <button
                type="submit"
                disabled={!addSymbolInput.trim()}
                className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50 transition"
              >
                Add Stock
              </button>
            </form>

            <div className="mt-5">
              <div className="text-xs font-semibold text-slate-700 mb-2">Tracked Symbols ({active.symbols.length}):</div>
              <ul className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                {active.symbols.map((s) => (
                  <li
                    key={s}
                    className="flex items-center justify-between rounded-xl bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-800 border border-slate-100"
                  >
                    <span>{s}</span>
                    <button
                      onClick={() => handleRemoveSymbol(s)}
                      className="rounded-md px-2 py-0.5 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition"
                    >
                      Remove
                    </button>
                  </li>
                ))}
                {active.symbols.length === 0 && (
                  <li className="text-xs text-slate-500 italic">No symbols yet — add one above.</li>
                )}
              </ul>
            </div>

            <div className="mt-8 border-t border-slate-100 pt-4 flex justify-end">
              <button
                onClick={() => {
                  if (confirm(`Are you sure you want to delete "${active.name}"?`)) {
                    deleteMut.mutate(active._id);
                  }
                }}
                className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:underline"
              >
                Delete this watchlist
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
