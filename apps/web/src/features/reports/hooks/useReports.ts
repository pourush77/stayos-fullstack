import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getReports,
  type ReportsOccupancyDto,
  type ReportsOperationsDto,
  type ReportsOverviewDto,
  type ReportsRevenueDto,
  type TopGuestDto,
} from '../api/reports-api';

export type ReportsState = {
  occupancy: ReportsOccupancyDto;
  operations: ReportsOperationsDto;
  overview: ReportsOverviewDto;
  revenue: ReportsRevenueDto;
  topGuests: TopGuestDto[];
};

export function useReports(propertyId: string | undefined, from: string, to: string) {
  const [data, setData] = useState<ReportsState>();
  const [error, setError] = useState<string>();
  const [isLoading, setIsLoading] = useState(false);

  const requestIdRef = useRef(0);

  const refresh = useCallback(async () => {
    if (!propertyId) {
      setIsLoading(false);
      return;
    }

    const requestId = ++requestIdRef.current;

    setIsLoading(true);
    setError(undefined);

    try {
      const result = await getReports(propertyId, from, to);

      // Ignore an older response if a newer date-range request
      // has already started.
      if (requestId !== requestIdRef.current) {
        return;
      }

      setData(result);
    } catch {
      // Do not let an outdated request replace the state of
      // the latest request.
      if (requestId !== requestIdRef.current) {
        return;
      }

      setError('Unable to load reports.');
    } finally {
      // Only the latest request is allowed to finish loading.
      if (requestId === requestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [from, propertyId, to]);

  useEffect(() => {
    void refresh();

    // Invalidate this request when the effect is replaced/unmounted.
    return () => {
      requestIdRef.current += 1;
    };
  }, [refresh]);

  return {
    data,
    error,
    isLoading,
    refresh,
  };
}
