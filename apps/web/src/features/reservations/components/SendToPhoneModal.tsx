'use client';

import { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Alert, Badge, Box, Button, CopyButton, Group, Modal, Stack, Text, ThemeIcon } from '@mantine/core';
import { Check, Copy, Loader2, Smartphone, WifiOff } from 'lucide-react';
import { radius, spacing } from '@stayos/theme';
import { showToast } from '@stayos/ui';
import {
  createMobileCaptureSession,
  getMobileCaptureSessionStatus,
  type MobileCaptureSessionDto,
} from '../../../lib/reservation-api';

interface Props {
  opened: boolean;
  onClose: () => void;
  propertyId: string;
  reservationId: string;
  frontUploadedInitially?: boolean;
  backUploadedInitially?: boolean;
  onCaptured: () => void;
}

/**
 * One-click Send-to-Phone modal.
 * Creates (or reuses) a mobile capture session, renders a big QR pointing to
 * the public /mobile-capture/:token page, and polls the session so the desk
 * refreshes as soon as the phone finishes uploading.
 */
export function SendToPhoneModal({
  opened,
  onClose,
  propertyId,
  reservationId,
  frontUploadedInitially = false,
  backUploadedInitially = false,
  onCaptured,
}: Props) {
  const [session, setSession] = useState<MobileCaptureSessionDto | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const lastNotifiedRef = useRef<{ front: boolean; back: boolean }>({
    front: frontUploadedInitially,
    back: backUploadedInitially,
  });

  // Create/reuse session once, when the modal opens.
  useEffect(() => {
    if (!opened) {
      setSession(undefined);
      setError(undefined);
      return;
    }
    lastNotifiedRef.current = { front: frontUploadedInitially, back: backUploadedInitially };
    let cancelled = false;
    setLoading(true);
    setError(undefined);
    createMobileCaptureSession(propertyId, reservationId)
      .then((s) => {
        if (!cancelled) setSession(s);
      })
      .catch((err) => {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : 'Could not create phone session';
        setError(msg);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [opened, propertyId, reservationId, frontUploadedInitially, backUploadedInitially]);

  // Poll session status every 3 seconds while modal is open. Notify parent when new uploads arrive.
  useEffect(() => {
    if (!opened || !session) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const next = await getMobileCaptureSessionStatus(propertyId, reservationId);
        if (cancelled) return;
        setSession(next);
        const prev = lastNotifiedRef.current;
        if ((next.frontUploaded && !prev.front) || (next.backUploaded && !prev.back)) {
          lastNotifiedRef.current = { front: next.frontUploaded, back: next.backUploaded };
          showToast({
            color: 'green',
            title: 'ID received from phone',
            message: 'Refreshing check-in workspace with the new photo…',
          });
          onCaptured();
        }
      } catch {
        // network hiccups are fine — next tick will try again
      }
    };
    const timer = setInterval(tick, 3000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [opened, session, propertyId, reservationId, onCaptured]);

  const captureUrl = session
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/mobile-capture/${session.token}`
    : '';

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Send capture to phone"
      centered
      size="lg"
      data-testid="send-to-phone-modal"
    >
      <Stack gap={spacing[3]}>
        <Alert color="stayosBrand" variant="light" icon={<Smartphone size={17} />}>
          <Text size="sm">
            <b>Scan this QR</b> from the guest&apos;s phone camera. The phone will open a page to snap the ID
            front and back — the images will land here automatically.
          </Text>
        </Alert>

        {error ? (
          <Alert color="red" variant="light" icon={<WifiOff size={17} />}>
            {error}
          </Alert>
        ) : null}

        {loading || !session ? (
          <Group justify="center" py={40} gap={12}>
            <Loader2 size={20} className="animate-spin" />
            <Text c="#64748b">Preparing secure link…</Text>
          </Group>
        ) : (
          <Group align="stretch" wrap="wrap" gap={spacing[4]} justify="center">
            <Box
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: radius.md,
                padding: 20,
                display: 'flex',
                justifyContent: 'center',
              }}
              data-testid="send-to-phone-qr"
            >
              <QRCodeSVG value={captureUrl} size={220} level="M" includeMargin={false} />
            </Box>
            <Stack gap={12} style={{ flex: 1, minWidth: 260 }}>
              <Text size="xs" fw={700} c="#64748b">STATUS</Text>
              <Group gap={8}>
                <StatusPill label="ID front" ok={session.frontUploaded} />
                <StatusPill label="ID back" ok={session.backUploaded} />
              </Group>
              <Text size="xs" fw={700} c="#64748b" mt={8}>OR SHARE THE LINK</Text>
              <Group gap={8} wrap="nowrap">
                <Text size="xs" style={{ flex: 1, fontFamily: 'monospace', wordBreak: 'break-all', background: '#f8fafc', padding: 8, borderRadius: 6 }}>
                  {captureUrl}
                </Text>
                <CopyButton value={captureUrl} timeout={2000}>
                  {({ copied, copy }) => (
                    <Button
                      variant="light"
                      size="xs"
                      color={copied ? 'green' : 'stayosBrand'}
                      leftSection={copied ? <Check size={14} /> : <Copy size={14} />}
                      onClick={copy}
                      data-testid="send-to-phone-copy"
                    >
                      {copied ? 'Copied' : 'Copy'}
                    </Button>
                  )}
                </CopyButton>
              </Group>
              <Text size="xs" c="#94a3b8">
                Link is single-use and expires in 30 minutes. Guest name: <b>{session.guestDisplayName}</b>
              </Text>
            </Stack>
          </Group>
        )}

        <Group justify="flex-end">
          <Button variant="subtle" color="gray" onClick={onClose} data-testid="send-to-phone-close">Done</Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function StatusPill({ label, ok }: { label: string; ok: boolean }) {
  return (
    <Badge
      color={ok ? 'green' : 'gray'}
      variant={ok ? 'filled' : 'light'}
      leftSection={
        ok ? (
          <ThemeIcon color="green" size={14} radius="xl"><Check size={10} /></ThemeIcon>
        ) : undefined
      }
    >
      {label}: {ok ? 'received' : 'waiting'}
    </Badge>
  );
}
