import { useState } from 'react';
import { GrowwLogo } from '../components/GrowwLogo';

export function Login({
  onLogin,
  loading,
  error,
}: {
  onLogin: (email: string, name?: string) => void;
  loading: boolean;
  error: string | null;
}) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] px-4">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-lg shadow-slate-100">
        <div className="mb-5">
          <GrowwLogo size={42} />
        </div>

        <p className="text-sm text-slate-600">
          Sign in to see what meaningfully changed in your stocks since your last visit.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onLogin(email, name || undefined);
          }}
          className="mt-6 space-y-3.5"
        >
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              required
              placeholder="investor@example.com"
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-600 focus:bg-white transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Display Name (Optional)</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Aarav Sharma"
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-600 focus:bg-white transition"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50 transition"
          >
            {loading ? 'Entering MarketPulse…' : 'Continue to Dashboard'}
          </button>
          {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}
        </form>

        <div className="mt-6 rounded-2xl bg-indigo-50/60 p-3 text-[11px] text-indigo-900 font-medium border border-indigo-100/80">
          💡 <span className="font-bold">Demo Login:</span> Password-free access for judges and evaluators. New emails automatically spin up sample NIFTY 50 watchlists and snapshot tracking.
        </div>
      </div>
    </div>
  );
}
