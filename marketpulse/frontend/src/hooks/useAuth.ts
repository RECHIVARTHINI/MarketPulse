import { useState } from 'react';
import { api, getStoredUserId, setStoredUserId } from '../api/client';

export function useAuth() {
  const [userId, setUserId] = useState<string | null>(getStoredUserId());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function login(email: string, displayName?: string) {
    setLoading(true);
    setError(null);
    try {
      const result = await api.demoLogin(email, displayName);
      setStoredUserId(result.userId as unknown as string);
      setUserId(result.userId as unknown as string);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return { userId, login, loading, error };
}
