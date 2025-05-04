import { useQuery } from '@tanstack/react-query';
import { useAuth } from './use-auth';
import { STAGING_API_URL } from '../config';
import csrfService from '../lib/csrf';

export interface TransferLimitStatus {
  usedAmount: number;
  remainingLimit: number;
  dailyLimit: number;
  resetTime: number | null;
}

export function useTransferLimits() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['transfer-limits'],
    queryFn: async (): Promise<TransferLimitStatus> => {
      if (!user) return { 
        usedAmount: 0, 
        remainingLimit: 1000, 
        dailyLimit: 1000, 
        resetTime: null 
      };
      
      const csrfToken = await csrfService.getToken();
      const response = await fetch(`${STAGING_API_URL}/api/wallet/limits`, {
        credentials: 'include',
        headers: { 
          'Accept': 'application/json',
          'X-CSRF-Token': csrfToken
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch transfer limits');
      }
      
      return response.json();
    },
    enabled: !!user,
    staleTime: 60000, // Consider data fresh for 1 minute
    refetchOnWindowFocus: false, // Don't refetch on window focus
  });
}
