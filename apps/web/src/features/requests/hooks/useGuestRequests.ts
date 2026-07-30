import { useCallback, useEffect, useState } from 'react';
import {
  createGuestRequest,
  getGuestRequestSummary,
  getGuestRequestSuggestions,
  listGuestRequests,
  transitionGuestRequest,
  type GuestRequestDepartment,
  type GuestRequestDto,
  type GuestRequestStatus,
  type GuestRequestSuggestionDto,
  type GuestRequestSummaryDto,
} from '../api/guest-requests-api';

export function useGuestRequests(propertyId?: string) {
  const [requests, setRequests] = useState<GuestRequestDto[]>([]);
  const [summary, setSummary] = useState<GuestRequestSummaryDto>();
  const [suggestions, setSuggestions] = useState<GuestRequestSuggestionDto[]>([]);
  const [status, setStatus] = useState<GuestRequestStatus | ''>('');
  const [department, setDepartment] = useState<GuestRequestDepartment | ''>('');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>();

  const refresh = useCallback(async () => {
    if (!propertyId) return;
    setIsLoading(true);
    setError(undefined);
    try {
      const [nextRequests, nextSummary, nextSuggestions] = await Promise.all([
        listGuestRequests(propertyId, { status: status || undefined, department: department || undefined, search: search || undefined }),
        getGuestRequestSummary(propertyId),
        getGuestRequestSuggestions(propertyId),
      ]);
      setRequests(nextRequests);
      setSummary(nextSummary);
      setSuggestions(nextSuggestions);
    } catch {
      setError('Unable to load guest requests.');
    } finally {
      setIsLoading(false);
    }
  }, [department, propertyId, search, status]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const create = async (payload: Record<string, unknown>) => {
    if (!propertyId) return;
    await createGuestRequest(propertyId, payload);
    await refresh();
  };

  const transition = async (requestId: string, action: 'accept' | 'start' | 'complete' | 'cancel') => {
    if (!propertyId) return;
    await transitionGuestRequest(propertyId, requestId, action);
    await refresh();
  };

  return {
    create,
    department,
    error,
    isLoading,
    refresh,
    requests,
    search,
    setDepartment,
    setSearch,
    setStatus,
    status,
    suggestions,
    summary,
    transition,
  };
}
