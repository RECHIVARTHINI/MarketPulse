import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';

// Polling is intentionally short (20s) so "since your last visit" feels
// alive during a demo without hammering the mock provider - production
// would likely move this to a push/WebSocket model, documented in
// docs/architecture.md as a known future improvement.
export function useChanges(watchlistId: string | null, commit = true) {
  return useQuery({
    queryKey: ['changes', watchlistId, commit],
    queryFn: () => api.getChanges(watchlistId as string, commit),
    enabled: !!watchlistId,
    refetchInterval: 20_000,
  });
}
