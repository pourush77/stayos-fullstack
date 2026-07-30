import { API_BASE_URL } from '../../../lib/api-base';

type ApiResponse<T> = T | { data?: T } | { items?: T } | { results?: T };

export type ReportsBreakdownDto = { label: string; value: number };
export type ReportsOverviewDto = {
  occupancyPercent: number;
  adr: number;
  revPar: number;
  revenue: number;
  arrivals: number;
  departures: number;
  openRequests: number;
  avgRequestResolutionMinutes: number;
};
export type ReportsOccupancyDto = {
  totalRooms: number;
  roomNightsAvailable: number;
  roomNightsOccupied: number;
  occupancyPercent: number;
  bySource: ReportsBreakdownDto[];
};
export type ReportsRevenueDto = {
  totalRevenue: number;
  totalPayments: number;
  adr: number;
  revPar: number;
  byChargeType: ReportsBreakdownDto[];
  byPaymentMethod: ReportsBreakdownDto[];
};
export type ReportsOperationsDto = {
  arrivals: number;
  departures: number;
  openRequests: number;
  completedRequests: number;
  overdueRequests: number;
  avgRequestResolutionMinutes: number;
};
export type TopGuestDto = {
  guestId: string;
  guestDisplayName: string;
  stays: number;
  revenue: number;
};

async function get<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, { cache: 'no-store', headers: { Accept: 'application/json' } });
  const payload = (await response.json().catch(() => undefined)) as ApiResponse<T> | undefined;
  if (!response.ok) throw new Error(`Reports request failed: ${response.status}`);
  return unwrap(payload as ApiResponse<T>);
}

function unwrap<T>(response: ApiResponse<T>): T {
  if (response && typeof response === 'object') {
    if ('data' in response && response.data !== undefined) return response.data;
    if ('items' in response && response.items !== undefined) return response.items;
    if ('results' in response && response.results !== undefined) return response.results;
  }
  return response as T;
}

function qs(from: string, to: string) {
  return `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
}

export async function getReports(propertyId: string, from: string, to: string) {
  const suffix = qs(from, to);
  const [overview, occupancy, revenue, operations, topGuests] = await Promise.all([
    get<ReportsOverviewDto>(`/properties/${propertyId}/reports/overview${suffix}`),
    get<ReportsOccupancyDto>(`/properties/${propertyId}/reports/occupancy${suffix}`),
    get<ReportsRevenueDto>(`/properties/${propertyId}/reports/revenue${suffix}`),
    get<ReportsOperationsDto>(`/properties/${propertyId}/reports/operations${suffix}`),
    get<TopGuestDto[]>(`/properties/${propertyId}/reports/top-guests${suffix}`),
  ]);
  return { overview, occupancy, revenue, operations, topGuests };
}
