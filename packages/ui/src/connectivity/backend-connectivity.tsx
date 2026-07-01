'use client';

import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

export type BackendConnectionStatus = 'ONLINE' | 'OFFLINE' | 'CONNECTING' | 'SERVER_STARTING';

type BackendConnectivityContextValue = {
  checkHealth: () => Promise<BackendConnectionStatus>;
  isOnline: boolean;
  lastSuccessfulConnection: Date | null;
  retry: () => Promise<BackendConnectionStatus>;
  status: BackendConnectionStatus;
};

const BackendConnectivityContext = createContext<BackendConnectivityContextValue | null>(null);

const onlineIntervalMs = 30_000;
const offlineIntervalMs = 10_000;

function apiBaseUrl() {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3002/api/v1';
}

function statusFromResponse(response: Response): BackendConnectionStatus {
  if (response.ok) return 'ONLINE';
  if (response.status === 503 || response.status === 502) return 'SERVER_STARTING';
  return 'OFFLINE';
}

export function BackendConnectivityProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<BackendConnectionStatus>('CONNECTING');
  const [lastSuccessfulConnection, setLastSuccessfulConnection] = useState<Date | null>(null);
  const inFlightRef = useRef(false);

  const checkHealth = useCallback(async () => {
    if (inFlightRef.current) return status;

    inFlightRef.current = true;
    setStatus((currentStatus) => (currentStatus === 'ONLINE' ? currentStatus : 'CONNECTING'));

    try {
      const response = await fetch(`${apiBaseUrl()}/health/ready`, {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });
      const nextStatus = statusFromResponse(response);

      setStatus(nextStatus);
      if (nextStatus === 'ONLINE') {
        setLastSuccessfulConnection(new Date());
      }

      return nextStatus;
    } catch {
      setStatus('OFFLINE');
      return 'OFFLINE';
    } finally {
      inFlightRef.current = false;
    }
  }, [status]);

  const retry = useCallback(() => checkHealth(), [checkHealth]);

  useEffect(() => {
    void checkHealth();
  }, [checkHealth]);

  useEffect(() => {
    const interval = window.setInterval(
      () => {
        void checkHealth();
      },
      status === 'ONLINE' ? onlineIntervalMs : offlineIntervalMs,
    );

    return () => window.clearInterval(interval);
  }, [checkHealth, status]);

  const value = useMemo<BackendConnectivityContextValue>(
    () => ({
      checkHealth,
      isOnline: status === 'ONLINE',
      lastSuccessfulConnection,
      retry,
      status,
    }),
    [checkHealth, lastSuccessfulConnection, retry, status],
  );

  return <BackendConnectivityContext.Provider value={value}>{children}</BackendConnectivityContext.Provider>;
}

export function useBackendStatus() {
  const context = useContext(BackendConnectivityContext);

  if (!context) {
    throw new Error('useBackendStatus must be used within BackendConnectivityProvider.');
  }

  return context;
}
