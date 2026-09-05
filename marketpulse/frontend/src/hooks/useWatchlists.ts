import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';

export function useWatchlists(enabled: boolean) {
  return useQuery({ queryKey: ['watchlists'], queryFn: api.listWatchlists, enabled });
}

export function useCreateWatchlist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, symbols }: { name: string; symbols: string[] }) => api.createWatchlist(name, symbols),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['watchlists'] }),
  });
}

export function useUpdateWatchlist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: { name?: string; addSymbols?: string[]; removeSymbols?: string[] } }) =>
      api.updateWatchlist(id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['watchlists'] });
      qc.invalidateQueries({ queryKey: ['changes'] });
    },
  });
}

export function useDeleteWatchlist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteWatchlist(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['watchlists'] }),
  });
}
