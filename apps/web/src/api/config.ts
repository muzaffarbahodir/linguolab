import { useQuery } from '@tanstack/react-query';
import { apiClient } from './client';

interface ExchangeRate {
  uzs_per_usd: number;
}

export function useExchangeRate() {
  return useQuery<ExchangeRate>({
    queryKey: ['config', 'exchange-rate'],
    queryFn: async () => {
      const res = await apiClient.get<ExchangeRate>('/config/exchange-rate');
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}
