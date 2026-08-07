'use client';

import { Alert, Button, Group, Modal, Stack, Text, Title } from '@mantine/core';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useAuth } from './auth-context';
import {
  createSessionSourceId,
  publishSessionEvent,
  subscribeToSessionEvents,
} from './session-channel';

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
  const sessionSourceIdRef = useRef(createSessionSourceId());

  const [warningOpen, setWarningOpen] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(warningCountdownSeconds);
  const [isContinuing, setIsContinuing] = useState(false);
  const [continueError, setContinueError] = useState<string>();

  const clearCountdownTimer = useCallback(() => {
    if (countdownTimerRef.current !== null) {
      window.clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
  }, []);

  const clearIdleTimers = useCallback(() => {
    if (warningTimerRef.current !== null) {
      window.clearTimeout(warningTimerRef.current);
      warningTimerRef.current = null;
    }

    if (lockTimerRef.current !== null) {
      window.clearTimeout(lockTimerRef.current);
      lockTimerRef.current = null;
    }

    clearCountdownTimer();
  }, [clearCountdownTimer]);

  const closeWarning = useCallback(() => {
    warningOpenRef.current = false;
    setWarningOpen(false);
    setContinueError(undefined);
    setSecondsRemaining(warningCountdownSeconds);
    clearCountdownTimer();
  }, [clearCountdownTimer, warningCountdownSeconds]);

  const lockApplication = useCallback(() => {
    clearIdleTimers();
    closeWarning();
    auth.lockSession();
  }, [auth, clearIdleTimers, closeWarning]);

  const startCountdown = useCallback(() => {
    let remaining = warningCountdownSeconds;

    setSecondsRemaining(remaining);
    clearCountdownTimer();

    countdownTimerRef.current = window.setInterval(() => {
      remaining -= 1;
      setSecondsRemaining(Math.max(0, remaining));

      if (remaining <= 0) {
        clearCountdownTimer();
      }
    }, 1_000);
  }, [clearCountdownTimer, warningCountdownSeconds]);

  const scheduleIdleTimers = useCallback(() => {
    clearIdleTimers();

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
    clearIdleTimers,
    lockApplication,
    lockMs,
    pathname,
    startCountdown,
    warningMs,
  ]);

  const resetFromActivity = useCallback(
    (shouldCloseWarning: boolean) => {
      if (
        !auth.isAuthenticated ||
        auth.isBootstrapping ||
        auth.isLocked ||
        isPublicPath(pathname)
      ) {
        return;
      }

      if (shouldCloseWarning) {
        closeWarning();
      }

      lastHandledActivityRef.current = Date.now();
      scheduleIdleTimers();
    },
    [
      auth.isAuthenticated,
      auth.isBootstrapping,
      auth.isLocked,
      closeWarning,
      pathname,
      scheduleIdleTimers,
    ],
  );

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

    publishSessionEvent({
      type: 'activity',
      timestamp: now,
      sourceId: sessionSourceIdRef.current,
    });
  }, [auth.isAuthenticated, auth.isBootstrapping, auth.isLocked, pathname, scheduleIdleTimers]);

  const continueWorking = useCallback(async () => {
    if (isContinuing) {
      return;
    }

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
  }, [auth, closeWarning, isContinuing, scheduleIdleTimers]);

  useEffect(() => {
    warningOpenRef.current = warningOpen;
  }, [warningOpen]);

  useEffect(() => {
    scheduleIdleTimers();

    return () => {
      clearIdleTimers();
    };
  }, [clearIdleTimers, scheduleIdleTimers]);

  useEffect(() => {
    return subscribeToSessionEvents((event) => {
      if (event.sourceId === sessionSourceIdRef.current) {
        return;
      }

      switch (event.type) {
        case 'activity':
          resetFromActivity(true);
          break;

        case 'tokens-refreshed':
        case 'unlocked':
          resetFromActivity(true);
          break;

        case 'locked':
          clearIdleTimers();
          closeWarning();
          break;

        case 'logout':
          clearIdleTimers();
          closeWarning();
          break;

        default:
          break;
      }
    });
  }, [clearIdleTimers, closeWarning, resetFromActivity]);

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
        overlayProps={{
          backgroundOpacity: 0.55,
          blur: 2,
        }}
        title={null}
        trapFocus
        withCloseButton={false}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void continueWorking();
          }}
        >
          <Stack gap="lg">
            <Stack gap={6}>
              <Title order={2} style={{ fontSize: 22, lineHeight: 1.25 }}>
                Your session is about to lock
              </Title>

              <Text c="dimmed" size="sm">
                You have been inactive for a while. Continue working to keep your StayOS session
                active.
              </Text>
            </Stack>

            <Stack align="center" gap={4}>
              <Text c="dimmed" size="xs" tt="uppercase" fw={700}>
                Time remaining
              </Text>

              <Text
                fw={700}
                ta="center"
                aria-live="polite"
                style={{
                  fontSize: 36,
                  fontVariantNumeric: 'tabular-nums',
                  letterSpacing: '0.04em',
                  lineHeight: 1.2,
                }}
              >
                {formatCountdown(secondsRemaining)}
              </Text>
            </Stack>

            {continueError ? (
              <Alert color="red" title="Unable to continue session">
                {continueError}
              </Alert>
            ) : null}

            <Group grow>
              <Button autoFocus loading={isContinuing} type="submit">
                Continue working
              </Button>

              <Button
                color="gray"
                disabled={isContinuing}
                type="button"
                variant="light"
                onClick={() => {
                  void auth.logout();
                }}
              >
                Logout
              </Button>
            </Group>

            <Text c="dimmed" size="xs" ta="center">
              Press Enter to continue your session.
            </Text>
          </Stack>
        </form>
      </Modal>
    </>
  );
}
