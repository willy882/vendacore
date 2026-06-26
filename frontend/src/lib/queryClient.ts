import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5 * 60 * 1000,   // 5 min — no refetch innecesarios
      gcTime:    15 * 60 * 1000,   // 15 min en caché
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      networkMode: 'offlineFirst', // no esperar online para renderizar desde caché
    },
  },
});
