import { useEffect, useState } from 'react';
import { useAuth } from './hooks/useAuth';
import { useWatchlists } from './hooks/useWatchlists';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { WatchlistManager } from './components/WatchlistManager';
import { DemoControlPanel } from './components/DemoControlPanel';
import { useQueryClient } from '@tanstack/react-query';

import { GrowwLogo } from './components/GrowwLogo';

type Tab = 'dashboard' | 'manage';

export default function App() {
  const { userId, login, loading, error } = useAuth();
  const { data: watchlists = [] } = useWatchlists(!!userId);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('dashboard');
  const qc = useQueryClient();

  useEffect(() => {
    if (!activeId && watchlists.length > 0) setActiveId(watchlists[0]._id);
  }, [watchlists, activeId]);

  if (!userId) {
    return <Login onLogin={login} loading={loading} error={error} />;
  }

  const active = watchlists.find((w) => w._id === activeId) || null;

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Groww-style Navigation Bar */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3.5">
          <GrowwLogo size={36} />

          <nav className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 border border-slate-200/80">
            <TabButton active={tab === 'dashboard'} onClick={() => setTab('dashboard')} label="Attention Feed" />
            <TabButton active={tab === 'manage'} onClick={() => setTab('manage')} label="Manage Lists" />
          </nav>
        </div>
      </header>

      {/* Main Container */}
      <main className="mx-auto max-w-5xl px-4 py-6">
        {/* Watchlist Quick Switcher Pill Bar */}
        {watchlists.length > 0 && tab === 'dashboard' && (
          <div className="mb-6 flex items-center justify-between gap-3 overflow-x-auto pb-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-600 mr-1 hidden sm:inline">Watchlists:</span>
              {watchlists.map((w) => (
                <button
                  key={w._id}
                  onClick={() => setActiveId(w._id)}
                  className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition ${
                    w._id === activeId
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  {w.name}
                  <span className={`ml-1.5 text-[11px] font-normal ${w._id === activeId ? 'text-indigo-200' : 'text-slate-600'}`}>
                    ({w.symbols.length})
                  </span>
                </button>
              ))}
            </div>

            <button
              onClick={() => setTab('manage')}
              className="shrink-0 text-xs font-semibold text-indigo-700 hover:text-indigo-800 hover:underline flex items-center gap-1"
            >
              <span>+ Add List</span>
            </button>
          </div>
        )}

        {tab === 'dashboard' && (
          <Dashboard
            watchlist={active}
            onSelectWatchlist={(id) => {
              setActiveId(id);
              setTab('dashboard');
            }}
          />
        )}

        {tab === 'manage' && (
          <WatchlistManager
            watchlists={watchlists}
            activeId={activeId}
            onSelect={(id) => {
              setActiveId(id);
              setTab('dashboard');
            }}
          />
        )}

        <DemoControlPanel onChanged={() => qc.invalidateQueries({ queryKey: ['changes'] })} />
      </main>
    </div>
  );
}

function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition ${
        active
          ? 'bg-white text-slate-900 shadow-xs'
          : 'text-slate-600 hover:text-slate-900'
      }`}
    >
      {label}
    </button>
  );
}
