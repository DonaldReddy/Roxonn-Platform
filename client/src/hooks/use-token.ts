import { useQuery } from '@tanstack/react-query';
import { useAuth } from './use-auth';
import { STAGING_API_URL } from '../config';

export function useToken() {
  const { user } = useAuth();
  
  const balanceQuery = useQuery({
    queryKey: ['token-balance'],
    queryFn: async (): Promise<string> => {
      if (!user) return '0';
      
      const response = await fetch(`${STAGING_API_URL}/api/token/balance`, {
        credentials: 'include', 
        headers: { 'Accept': 'application/json' }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch token balance');
      }
      
      const data = await response.json();
      return data.balance;
    },
    enabled: !!user,
    staleTime: 30 * 1000, // Consider data fresh for 30 seconds
    refetchOnWindowFocus: true,
  });
  
  return {
    balance: balanceQuery.data || '0',
    isLoading: balanceQuery.isLoading,
    isError: balanceQuery.isError,
    refetch: balanceQuery.refetch
  };
} 