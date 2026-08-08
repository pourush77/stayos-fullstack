import { useCallback, useEffect, useRef, useState } from 'react';
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
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [error, setError] = useState<string>();

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
      const [nextTickets, nextSummary] = await Promise.all([
        listMaintenanceTickets(propertyId, {
          status: status || undefined,
        }),
        getMaintenanceSummary(propertyId),
      ]);

      // Ignore an older response when a newer request has already started.
      if (requestId !== requestIdRef.current) {
        return;
      }

      setTickets(nextTickets);
      setSummary(nextSummary);
      setHasLoadedOnce(true);
    } catch {
      // Do not allow an outdated request to change the latest state.
      if (requestId !== requestIdRef.current) {
        return;
      }

      setError('Unable to load maintenance tickets.');
      setHasLoadedOnce(true);
    } finally {
      // Only the newest request can finish the loading state.
      if (requestId === requestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [propertyId, status]);

  useEffect(() => {
    void refresh();

    return () => {
      // Invalidate the request belonging to the previous effect.
      requestIdRef.current += 1;
    };
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
    hasLoadedOnce,
    isLoading,
    refresh,
    resolve,
    setStatus,
    status,
    summary,
    tickets,
  };
}
