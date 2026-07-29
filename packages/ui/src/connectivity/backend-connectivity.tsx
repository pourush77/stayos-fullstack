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
const healthResultCacheMs = 5_000;

let sharedHealthInFlight: Promise<BackendConnectionStatus> | undefined;
let sharedHealthResult:
  | { checkedAt: number; status: BackendConnectionStatus; successfulAt: Date | null }
  | undefined;

function apiBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    'http://localhost:3002/api/v1'
  );
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
  const statusRef = useRef<BackendConnectionStatus>('CONNECTING');

  const checkHealth = useCallback(async () => {
    if (inFlightRef.current) return statusRef.current;

    if (
      sharedHealthResult &&
      Date.now() - sharedHealthResult.checkedAt < healthResultCacheMs
    ) {
      statusRef.current = sharedHealthResult.status;
      setStatus(sharedHealthResult.status);
      setLastSuccessfulConnection(sharedHealthResult.successfulAt);
      return sharedHealthResult.status;
    }

    if (sharedHealthInFlight) {
      const nextStatus = await sharedHealthInFlight;
      statusRef.current = nextStatus;
      setStatus(nextStatus);
      setLastSuccessfulConnection(sharedHealthResult?.successfulAt ?? null);
      return nextStatus;
    }

    inFlightRef.current = true;
    setStatus((currentStatus) => (currentStatus === 'ONLINE' ? currentStatus : 'CONNECTING'));

    try {
      sharedHealthInFlight = fetch(`${apiBaseUrl()}/health/ready`, {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      }).then(statusFromResponse);
      const nextStatus = await sharedHealthInFlight;

      statusRef.current = nextStatus;
      setStatus(nextStatus);
      const successfulAt = nextStatus === 'ONLINE' ? new Date() : null;
      sharedHealthResult = { checkedAt: Date.now(), status: nextStatus, successfulAt };
      if (nextStatus === 'ONLINE') {
        setLastSuccessfulConnection(successfulAt);
      }

      return nextStatus;
    } catch {
      statusRef.current = 'OFFLINE';
      setStatus('OFFLINE');
      sharedHealthResult = { checkedAt: Date.now(), status: 'OFFLINE', successfulAt: null };
      return 'OFFLINE';
    } finally {
      inFlightRef.current = false;
      sharedHealthInFlight = undefined;
    }
  }, []);

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
