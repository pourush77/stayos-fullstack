'use client';

import { Alert, Button, Group, Modal, Stack, Text, Title } from '@mantine/core';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useAuth } from './auth-context';

const DEFAULT_WARNING_MINUTES = 18;
const DEFAULT_LOCK_MINUTES = 20;
const ACTIVITY_THROTTLE_MS = 15_000;

const publicPaths = new Set(['/login']);

function isPublicPath(pathname: string | null) {
  return Boolean(
    pathname &&
    (publicPaths.has(pathname) ||
      pathname.startsWith('/housekeeping/staff/') ||
      pathname.startsWith('/check-in-capture/') ||
      pathname.startsWith('/mobile-capture/')),
  );
}

function readPositiveNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function formatCountdown(totalSeconds: number) {
  const safeSeconds = Math.max(0, totalSeconds);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function SessionActivityProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const auth = useAuth();

  const warningMinutes = readPositiveNumber(
    process.env.NEXT_PUBLIC_SESSION_WARNING_MINUTES,
    DEFAULT_WARNING_MINUTES,
  );
  const lockMinutes = readPositiveNumber(
    process.env.NEXT_PUBLIC_SESSION_LOCK_MINUTES,
    DEFAULT_LOCK_MINUTES,
  );

  const warningMs = warningMinutes * 60_000;
  const lockMs = Math.max(lockMinutes * 60_000, warningMs + 1_000);
  const warningCountdownSeconds = Math.max(1, Math.ceil((lockMs - warningMs) / 1_000));

  const warningTimerRef = useRef<number | null>(null);
  const lockTimerRef = useRef<number | null>(null);
  const countdownTimerRef = useRef<number | null>(null);
  const lastHandledActivityRef = useRef(0);
  const warningOpenRef = useRef(false);

  const [warningOpen, setWarningOpen] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(warningCountdownSeconds);
  const [isContinuing, setIsContinuing] = useState(false);
  const [continueError, setContinueError] = useState<string>();

  const clearTimers = useCallback(() => {
    if (warningTimerRef.current) {
      window.clearTimeout(warningTimerRef.current);
      warningTimerRef.current = null;
    }

    if (lockTimerRef.current) {
      window.clearTimeout(lockTimerRef.current);
      lockTimerRef.current = null;
    }

    if (countdownTimerRef.current) {
      window.clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
  }, []);

  const closeWarning = useCallback(() => {
    warningOpenRef.current = false;
    setWarningOpen(false);
    setContinueError(undefined);
    setSecondsRemaining(warningCountdownSeconds);

    if (countdownTimerRef.current) {
      window.clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
  }, [warningCountdownSeconds]);

  const lockApplication = useCallback(() => {
    clearTimers();
    closeWarning();
    auth.lockSession();
  }, [auth, clearTimers, closeWarning]);

  const startCountdown = useCallback(() => {
    let remaining = warningCountdownSeconds;
    setSecondsRemaining(remaining);

    if (countdownTimerRef.current) {
      window.clearInterval(countdownTimerRef.current);
    }

    countdownTimerRef.current = window.setInterval(() => {
      remaining -= 1;
      setSecondsRemaining(Math.max(0, remaining));

      if (remaining <= 0 && countdownTimerRef.current) {
        window.clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
    }, 1_000);
  }, [warningCountdownSeconds]);

  const scheduleIdleTimers = useCallback(() => {
    clearTimers();

    if (!auth.isAuthenticated || auth.isBootstrapping || auth.isLocked || isPublicPath(pathname)) {
      return;
    }

    warningTimerRef.current = window.setTimeout(() => {
      warningOpenRef.current = true;
      setWarningOpen(true);
      setContinueError(undefined);
      startCountdown();
    }, warningMs);

    lockTimerRef.current = window.setTimeout(() => {
      lockApplication();
    }, lockMs);
  }, [
    auth.isAuthenticated,
    auth.isBootstrapping,
    auth.isLocked,
    clearTimers,
    lockApplication,
    lockMs,
    pathname,
    startCountdown,
    warningMs,
  ]);

  const registerActivity = useCallback(() => {
    if (
      !auth.isAuthenticated ||
      auth.isBootstrapping ||
      auth.isLocked ||
      warningOpenRef.current ||
      isPublicPath(pathname)
    ) {
      return;
    }

    const now = Date.now();

    if (now - lastHandledActivityRef.current < ACTIVITY_THROTTLE_MS) {
      return;
    }

    lastHandledActivityRef.current = now;
    scheduleIdleTimers();
  }, [auth.isAuthenticated, auth.isBootstrapping, auth.isLocked, pathname, scheduleIdleTimers]);

  const continueWorking = useCallback(async () => {
    setIsContinuing(true);
    setContinueError(undefined);

    try {
      await auth.continueSession();
      closeWarning();
      lastHandledActivityRef.current = Date.now();
      scheduleIdleTimers();
    } catch (error) {
      setContinueError(error instanceof Error ? error.message : 'Unable to continue your session.');
    } finally {
      setIsContinuing(false);
    }
  }, [auth, closeWarning, scheduleIdleTimers]);

  useEffect(() => {
    warningOpenRef.current = warningOpen;
  }, [warningOpen]);

  useEffect(() => {
    scheduleIdleTimers();

    return () => {
      clearTimers();
    };
  }, [clearTimers, scheduleIdleTimers]);

  useEffect(() => {
    if (!auth.isAuthenticated || auth.isBootstrapping || auth.isLocked || isPublicPath(pathname)) {
      return undefined;
    }

    const activityEvents: Array<keyof WindowEventMap> = [
      'pointerdown',
      'keydown',
      'touchstart',
      'scroll',
    ];

    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, registerActivity, {
        capture: true,
        passive: eventName !== 'keydown',
      });
    });

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        registerActivity();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, registerActivity, true);
      });

      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [auth.isAuthenticated, auth.isBootstrapping, auth.isLocked, pathname, registerActivity]);

  return (
    <>
      {children}

      <Modal
        centered
        closeOnClickOutside={false}
        closeOnEscape={false}
        onClose={() => undefined}
        opened={warningOpen && !auth.isLocked}
        title={null}
        withCloseButton={false}
      >
        <Stack gap="lg">
          <Stack gap={6}>
            <Title order={2} style={{ fontSize: 22, lineHeight: 1.25 }}>
              Still working?
            </Title>

            <Text c="dimmed" size="sm">
              StayOS will lock because there has been no activity.
            </Text>
          </Stack>

          <Text
            fw={700}
            ta="center"
            style={{
              fontSize: 34,
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: '0.04em',
            }}
          >
            {formatCountdown(secondsRemaining)}
          </Text>

          {continueError ? (
            <Alert color="red" title="Unable to continue session">
              {continueError}
            </Alert>
          ) : null}

          <Group grow>
            <Button
              loading={isContinuing}
              onClick={() => {
                void continueWorking();
              }}
            >
              Continue working
            </Button>

            <Button
              color="gray"
              disabled={isContinuing}
              variant="light"
              onClick={() => {
                void auth.logout();
              }}
            >
              Logout
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
