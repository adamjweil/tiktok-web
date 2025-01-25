import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60000, // Data considered fresh for 1 minute
      cacheTime: 3600000, // Cache persists for 1 hour
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
}); 