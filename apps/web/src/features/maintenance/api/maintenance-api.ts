import { API_BASE_URL } from '../../../lib/api-base';

type ApiResponse<T> = T | { data?: T } | { items?: T } | { results?: T };

export type MaintenanceTicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CANCELLED';
export type MaintenanceTicketPriority = 'LOW' | 'NORMAL' | 'HIGH';
export type MaintenanceTicketCategory = 'PLUMBING' | 'ELECTRICAL' | 'HVAC' | 'APPLIANCE' | 'OTHER';

export type MaintenanceTicketDto = {
  id: string;
  propertyId: string;
  roomId: string | null;
  roomNumber: string | null;
  reportedByUserId: string;
  assignedToUserId: string | null;
  title: string;
  description: string | null;
  category: MaintenanceTicketCategory;
  priority: MaintenanceTicketPriority;
  status: MaintenanceTicketStatus;
  reportedAt: string;
  resolvedAt: string | null;
  resolutionNote: string | null;
};

export type MaintenanceSummaryDto = {
  open: number;
  inProgress: number;
  resolved: number;
  highPriority: number;
};

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });
  const payload = (await response.json().catch(() => undefined)) as ApiResponse<T> | undefined;
  if (!response.ok) throw new Error(`Maintenance request failed: ${response.status}`);
  return unwrap<T>(payload as ApiResponse<T>);
}

function unwrap<T>(response: ApiResponse<T>): T {
  if (response && typeof response === 'object') {
    if ('data' in response && response.data !== undefined) return response.data;
    if ('items' in response && response.items !== undefined) return response.items;
    if ('results' in response && response.results !== undefined) return response.results;
  }
  return response as T;
}

function queryString(params: Record<string, string | undefined>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) query.set(key, value);
  });
  const serialized = query.toString();
  return serialized ? `?${serialized}` : '';
}

export function listMaintenanceTickets(propertyId: string, params: { status?: string }) {
  return request<MaintenanceTicketDto[]>(`/properties/${propertyId}/maintenance${queryString(params)}`);
}

export function getMaintenanceSummary(propertyId: string) {
  return request<MaintenanceSummaryDto>(`/properties/${propertyId}/maintenance/summary`);
}

export function createMaintenanceTicket(propertyId: string, payload: Record<string, unknown>) {
  return request<MaintenanceTicketDto>(`/properties/${propertyId}/maintenance`, {
    body: JSON.stringify(payload),
    method: 'POST',
  });
}

export function assignMaintenanceTicket(propertyId: string, ticketId: string, assignedToUserId: string) {
  return request<MaintenanceTicketDto>(`/properties/${propertyId}/maintenance/${ticketId}/assign`, {
    body: JSON.stringify({ assignedToUserId }),
    method: 'PATCH',
  });
}

export function resolveMaintenanceTicket(propertyId: string, ticketId: string, resolutionNote?: string) {
  return request<MaintenanceTicketDto>(`/properties/${propertyId}/maintenance/${ticketId}/resolve`, {
    body: JSON.stringify({ resolutionNote }),
    method: 'PATCH',
  });
}

export function cancelMaintenanceTicket(propertyId: string, ticketId: string) {
  return request<MaintenanceTicketDto>(`/properties/${propertyId}/maintenance/${ticketId}/cancel`, {
    method: 'PATCH',
  });
}
