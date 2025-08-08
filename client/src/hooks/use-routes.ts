// use-routes.ts
import { useQuery } from '@tanstack/react-query';
import { intearAPI } from '../services/intear-api';
import { RouteRequest, RouteInfo } from '@shared/schema';

export function useRoutes(request: RouteRequest | null, enabled: boolean = true) {
  return useQuery({
    queryKey: ['routes', request],
    queryFn: async (): Promise<RouteInfo[]> => {
      if (!request) return [];
      
      try {
        // Get routes from Intear API
        const intearRoutes = await intearAPI.getRoutes(request);
        return intearRoutes;
      } catch (error) {
        console.error('Failed to fetch routes:', error);
        throw error;
      }
    },
    enabled: enabled && !!request,
    staleTime: 10000, // Consider data stale after 10 seconds
    refetchInterval: 15000, // Refetch every 15 seconds
  });
}

export function useBestRoute(routes: RouteInfo[] | undefined) {
  if (!routes || routes.length === 0) return null;
  return intearAPI.getBestRoute(routes);
}