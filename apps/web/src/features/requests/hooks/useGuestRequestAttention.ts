'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getGuestRequestAttention, type GuestRequestAttentionDto } from '../api/guest-requests-api';

type GuestRequestAttentionState = {
  items: GuestRequestAttentionDto[];
  isLoading: boolean;
  error?: string;
};

type UseGuestRequestAttentionOptions = {
  enabled?: boolean;
  pollIntervalMs?: number;
};

export function useGuestRequestAttention(
  propertyId?: string,
  { enabled = true, pollIntervalMs = 30_000 }: UseGuestRequestAttentionOptions = {},
) {
  const [state, setState] = useState<GuestRequestAttentionState>({
    items: [],
    isLoading: false,
  });

  const inFlightRef = useRef(false);
  const mountedRef = useRef(true);

  const loadAttention = useCallback(
    async ({ showLoading = false }: { showLoading?: boolean } = {}) => {
      if (!enabled || !propertyId || inFlightRef.current) return;

      inFlightRef.current = true;

      if (showLoading) {
        setState((current) => ({
          ...current,
          error: undefined,
          isLoading: current.items.length === 0,
        }));
      }

      try {
        const items = await getGuestRequestAttention(propertyId);

        if (!mountedRef.current) return;

        setState({
          items,
          isLoading: false,
        });
      } catch (error) {
        if (!mountedRef.current) return;

        setState((current) => ({
          ...current,
          error:
            error instanceof Error ? error.message : 'Unable to load operational attention items.',
          isLoading: false,
        }));
      } finally {
        inFlightRef.current = false;
      }
    },
    [enabled, propertyId],
  );

  useEffect(() => {
    mountedRef.current = true;

    if (!enabled || !propertyId) {
      setState({
        items: [],
        isLoading: false,
      });

      return () => {
        mountedRef.current = false;
      };
    }

    void loadAttention({ showLoading: true });

    const interval = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      void loadAttention();
    }, pollIntervalMs);

    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') {
        void loadAttention();
      }
    };

    const refreshOnFocus = () => {
      if (document.visibilityState === 'visible') {
        void loadAttention();
      }
    };

    document.addEventListener('visibilitychange', refreshWhenVisible);
    window.addEventListener('focus', refreshOnFocus);

    return () => {
      mountedRef.current = false;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      window.removeEventListener('focus', refreshOnFocus);
    };
  }, [enabled, loadAttention, pollIntervalMs, propertyId]);

  const refresh = useCallback(() => loadAttention(), [loadAttention]);

  const criticalCount = state.items.filter((item) => item.severity === 'CRITICAL').length;

  const warningCount = state.items.filter((item) => item.severity === 'WARNING').length;

  const dueSoonCount = state.items.filter((item) => item.attentionState === 'DUE_SOON').length;

  const escalatedCount = state.items.filter((item) => item.attentionState === 'ESCALATED').length;

  return {
    ...state,
    count: state.items.length,
    criticalCount,
    warningCount,
    dueSoonCount,
    escalatedCount,
    refresh,
  };
}
