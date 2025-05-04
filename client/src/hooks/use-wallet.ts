import { useEffect, useState } from 'react';
import { useAuth } from './use-auth';
import { STAGING_API_URL } from '../config';
import { useQuery } from '@tanstack/react-query';

interface WalletInfo {
  address: string;
  balance: string;
  tokenBalance: string;
}

export function useWallet() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['wallet-info'],
    queryFn: async (): Promise<WalletInfo> => {
      if (!user) return { address: '', balance: '0', tokenBalance: '0' };
      
      const response = await fetch(`${STAGING_API_URL}/api/wallet/info`, {
        credentials: 'include', 
        headers: { 'Accept': 'application/json' }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch wallet info');
      }
      
      return response.json();
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    refetchOnWindowFocus: false,
  });
} 