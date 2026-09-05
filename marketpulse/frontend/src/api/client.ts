import { ApiEnvelope, ApiErrorEnvelope } from '../types';

const rawApiUrl = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '';
const API_BASE_URL = rawApiUrl
  ? (rawApiUrl.endsWith('/api') ? rawApiUrl : `${rawApiUrl.replace(/\/+$/, '')}/api`)
  : '/api';
const USER_ID_KEY = 'marketpulse.demoUserId';

export function getStoredUserId(): string | null {
  return localStorage.getItem(USER_ID_KEY);
}

export function setStoredUserId(userId: string) {
  localStorage.setItem(USER_ID_KEY, userId);
}

export class ApiRequestError extends Error {
  constructor(public code: string, message: string, public status: number, public details?: unknown) {
    super(message);
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const userId = getStoredUserId();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(userId ? { 'x-demo-user-id': userId } : {}),
    ...(options.headers as Record<string, string>),
  };

  const res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  const json = (await res.json().catch(() => null)) as ApiEnvelope<T> | ApiErrorEnvelope | null;

  if (!res.ok || !json || json.success === false) {
    const err = json as ApiErrorEnvelope | null;
    throw new ApiRequestError(
      err?.error?.code || 'UNKNOWN_ERROR',
      err?.error?.message || `Request to ${path} failed with status ${res.status}`,
      res.status,
      err?.error?.details
    );
  }

  return (json as ApiEnvelope<T>).data;
}

export const api = {
  demoLogin: (email: string, displayName?: string) =>
    request<{ userId: string; email: string; displayName: string; attentionBudget: number }>('/auth/demo-login', {
      method: 'POST',
      body: JSON.stringify({ email, displayName }),
    }),

  listWatchlists: () => request<import('../types').Watchlist[]>('/watchlists'),
  createWatchlist: (name: string, symbols: string[]) =>
    request<import('../types').Watchlist>('/watchlists', { method: 'POST', body: JSON.stringify({ name, symbols }) }),
  updateWatchlist: (id: string, patch: { name?: string; addSymbols?: string[]; removeSymbols?: string[] }) =>
    request<import('../types').Watchlist>(`/watchlists/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  deleteWatchlist: (id: string) => request<{ deleted: boolean }>(`/watchlists/${id}`, { method: 'DELETE' }),

  getChanges: (watchlistId: string, commit = true) =>
    request<import('../types').ChangesResponse>(`/watchlists/${watchlistId}/changes?commit=${commit}`),

  getGlobalPriority: () =>
    request<import('../types').CrossWatchlistPriorityResponse>('/watchlists/priority'),

  snoozeSymbol: (watchlistId: string, symbol: string, durationHours?: number, untilMarketClose?: boolean) =>
    request<{ symbol: string; watchlistId: string; mutedUntil: string; message: string }>(
      `/watchlists/${watchlistId}/snooze`,
      { method: 'POST', body: JSON.stringify({ symbol, durationHours, untilMarketClose }) }
    ),

  unsnoozeSymbol: (watchlistId: string, symbol: string) =>
    request<{ symbol: string; watchlistId: string; unmuted: boolean; message: string }>(
      `/watchlists/${watchlistId}/unsnooze`,
      { method: 'POST', body: JSON.stringify({ symbol }) }
    ),

  getStockDetail: (symbol: string) => request<import('../types').StockDetailResponse>(`/market/detail/${symbol}`),

  listDemoScenarios: () =>
    request<{ scenarios: string[]; availableSymbols: string[] }>('/market/demo/scenarios'),
  setDemoScenario: (symbol: string, scenario: string) =>
    request<{ symbol: string; scenario: string }>('/market/demo/scenario', {
      method: 'POST',
      body: JSON.stringify({ symbol, scenario }),
    }),
};
