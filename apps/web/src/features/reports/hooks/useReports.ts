import { useCallback, useEffect, useState } from 'react';
import { getReports, type ReportsOccupancyDto, type ReportsOperationsDto, type ReportsOverviewDto, type ReportsRevenueDto, type TopGuestDto } from '../api/reports-api';

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

  const refresh = useCallback(async () => {
    if (!propertyId) return;
    setIsLoading(true);
    setError(undefined);
    try {
      setData(await getReports(propertyId, from, to));
    } catch {
      setError('Unable to load reports.');
    } finally {
      setIsLoading(false);
    }
  }, [from, propertyId, to]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, error, isLoading, refresh };
}
