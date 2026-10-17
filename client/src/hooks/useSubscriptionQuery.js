import { useQuery } from "@tanstack/react-query";
import { fetchUserSubscription } from "../api/billing.api";

export const SUBSCRIPTION_QUERY_KEY = ["subscription"];

export function useSubscriptionQuery(options = {}) {
  return useQuery({
    queryKey: SUBSCRIPTION_QUERY_KEY,
    queryFn: async () => {
      const data = await fetchUserSubscription();
      return data || null;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes fresh
    ...options,
  });
}
