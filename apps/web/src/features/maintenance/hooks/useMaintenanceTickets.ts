import { useCallback, useEffect, useState } from 'react';
import {
  assignMaintenanceTicket,
  cancelMaintenanceTicket,
  createMaintenanceTicket,
  getMaintenanceSummary,
  listMaintenanceTickets,
  resolveMaintenanceTicket,
  type MaintenanceSummaryDto,
  type MaintenanceTicketDto,
  type MaintenanceTicketStatus,
} from '../api/maintenance-api';

export function useMaintenanceTickets(propertyId?: string) {
  const [tickets, setTickets] = useState<MaintenanceTicketDto[]>([]);
  const [summary, setSummary] = useState<MaintenanceSummaryDto>();
  const [status, setStatus] = useState<MaintenanceTicketStatus | ''>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>();

  const refresh = useCallback(async () => {
    if (!propertyId) return;
    setIsLoading(true);
    setError(undefined);
    try {
      const [nextTickets, nextSummary] = await Promise.all([
        listMaintenanceTickets(propertyId, { status: status || undefined }),
        getMaintenanceSummary(propertyId),
      ]);
      setTickets(nextTickets);
      setSummary(nextSummary);
    } catch {
      setError('Unable to load maintenance tickets.');
    } finally {
      setIsLoading(false);
    }
  }, [propertyId, status]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const create = async (payload: Record<string, unknown>) => {
    if (!propertyId) return;
    await createMaintenanceTicket(propertyId, payload);
    await refresh();
  };

  const assign = async (ticketId: string, assignedToUserId: string) => {
    if (!propertyId) return;
    await assignMaintenanceTicket(propertyId, ticketId, assignedToUserId);
    await refresh();
  };

  const resolve = async (ticketId: string, resolutionNote?: string) => {
    if (!propertyId) return;
    await resolveMaintenanceTicket(propertyId, ticketId, resolutionNote);
    await refresh();
  };

  const cancel = async (ticketId: string) => {
    if (!propertyId) return;
    await cancelMaintenanceTicket(propertyId, ticketId);
    await refresh();
  };

  return {
    assign,
    cancel,
    create,
    error,
    isLoading,
    refresh,
    resolve,
    setStatus,
    status,
    summary,
    tickets,
  };
}
