import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 minutes fresh window
      gcTime: 1000 * 60 * 10,   // 10 minutes cache retention
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});
