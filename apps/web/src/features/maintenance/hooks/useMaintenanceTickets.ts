import { useCallback, useEffect, useRef, useState } from 'react';
import {
  assignMaintenanceTicket,
  cancelMaintenanceTicket,
  createMaintenanceTicket,
  getMaintenanceSummary,
  listMaintenanceTickets,
  resolveMaintenanceTicket,
  type CreateMaintenanceTicketPayload,
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
  const [mutationKey, setMutationKey] = useState<string>();

  const requestIdRef = useRef(0);
  const mutationBusyRef = useRef<string | null>(null);

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

  const runMutation = async (
    key: string,
    action: () => Promise<unknown>,
    failureMessage: string,
  ): Promise<boolean> => {
    if (!propertyId || mutationBusyRef.current) return false;

    mutationBusyRef.current = key;
    setMutationKey(key);
    setError(undefined);

    try {
      await action();
      await refresh();
      return true;
    } catch {
      setError(failureMessage);
      return false;
    } finally {
      mutationBusyRef.current = null;
      setMutationKey(undefined);
    }
  };

  const create = async (payload: CreateMaintenanceTicketPayload): Promise<boolean> =>
    runMutation(
      'create',
      () => createMaintenanceTicket(propertyId as string, payload),
      'Unable to create maintenance ticket.',
    );

  const assign = async (ticketId: string, assignedToUserId: string): Promise<boolean> =>
    runMutation(
      `assign:${ticketId}`,
      () => assignMaintenanceTicket(propertyId as string, ticketId, assignedToUserId),
      'Unable to accept maintenance ticket.',
    );

  const resolve = async (ticketId: string, resolutionNote?: string): Promise<boolean> =>
    runMutation(
      `resolve:${ticketId}`,
      () => resolveMaintenanceTicket(propertyId as string, ticketId, resolutionNote),
      'Unable to resolve maintenance ticket.',
    );

  const cancel = async (ticketId: string): Promise<boolean> =>
    runMutation(
      `cancel:${ticketId}`,
      () => cancelMaintenanceTicket(propertyId as string, ticketId),
      'Unable to cancel maintenance ticket.',
    );

  return {
    assign,
    cancel,
    create,
    error,
    hasLoadedOnce,
    isLoading,
    mutationKey,
    refresh,
    resolve,
    setStatus,
    status,
    summary,
    tickets,
  };
}
