'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { Alert, Badge, Box, Button, Card, Center, Group, Loader, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import { Camera, Check, IdCard, ShieldCheck, WifiOff } from 'lucide-react';
import { radius, spacing } from '@stayos/theme';
import { showToast } from '@stayos/ui';
import {
  getPublicCaptureSession,
  uploadPublicCaptureDocument,
  type MobileCaptureSessionDto,
} from '../../lib/reservation-api';

/**
 * Public phone-side ID capture page.
 * Guest scans a QR code -> lands here -> two big buttons that open their
 * phone camera to snap the ID front / back. Uploads are streamed back to
 * the receptionist automatically.
 */
export default function MobileCapturePage() {
  const params = useParams<{ token: string }>();
  const token = params.token ?? '';
  const [session, setSession] = useState<MobileCaptureSessionDto | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [uploading, setUploading] = useState<'front' | 'back' | null>(null);

  const frontInputRef = useRef<HTMLInputElement>(null);
  const backInputRef = useRef<HTMLInputElement>(null);

  const loadSession = useCallback(async () => {
    if (!token) return;
    try {
      const s = await getPublicCaptureSession(token);
      setSession(s);
      setError(undefined);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Session invalid';
      setError(message);
    }
  }, [token]);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  const handleUpload = async (side: 'front' | 'back', file: File | null) => {
    if (!file) return;
    setUploading(side);
    try {
      const next = await uploadPublicCaptureDocument(
        token,
        side === 'front' ? 'ID_FRONT' : 'ID_BACK',
        file,
      );
      setSession(next);
      showToast({
        color: 'green',
        title: `ID ${side} sent`,
        message: 'The receptionist can see it on their screen.',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      showToast({ color: 'red', title: 'Upload failed', message });
    } finally {
      setUploading(null);
    }
  };

  if (error) {
    return (
      <Center mih="100vh" px={16}>
        <Card radius={radius.lg} p={24} maw={420} w="100%" style={{ background: '#ffffff', border: '1px solid #fecaca' }}>
          <Stack align="center" gap={12}>
            <ThemeIcon color="red" size={44} radius="xl" variant="light"><WifiOff size={22} /></ThemeIcon>
            <Title order={3} c="#7f1d1d">Link expired</Title>
            <Text c="#64748b" ta="center">{error}</Text>
            <Text c="#94a3b8" ta="center" size="xs">
              Ask the receptionist to open a fresh Send-to-Phone QR.
            </Text>
          </Stack>
        </Card>
      </Center>
    );
  }

  if (!session) {
    return (
      <Center mih="100vh"><Loader color="stayosBrand" /></Center>
    );
  }

  const isComplete = session.frontUploaded && session.backUploaded;

  return (
    <Box style={{ background: '#f8fafc', minHeight: '100vh', padding: 16 }}>
      <Card radius={radius.lg} p={20} maw={520} mx="auto" style={{ background: '#ffffff', border: '1px solid #e2e8f0' }}>
        <Stack gap={spacing[3]}>
          <Group gap={10}>
            <ThemeIcon color="stayosBrand" size={40} radius="xl" variant="light"><IdCard size={20} /></ThemeIcon>
            <Stack gap={0}>
              <Title order={3} c="#101828" style={{ lineHeight: 1.1 }}>Send ID to reception</Title>
              <Text c="#64748b" size="sm">For <b>{session.guestDisplayName}</b> · Booking {session.reservationReference}</Text>
            </Stack>
          </Group>

          <Alert color="stayosBrand" variant="light">
            <Text size="sm">
              Tap the buttons below to snap the front and back of the guest&apos;s ID with this phone.
              The photos will appear on the receptionist&apos;s screen automatically.
            </Text>
          </Alert>

          <CaptureRow
            label="ID front"
            hint="Aadhaar / Passport / DL / Voter ID"
            uploaded={session.frontUploaded}
            uploading={uploading === 'front'}
            onClick={() => frontInputRef.current?.click()}
            data-testid="phone-snap-front"
          />
          <CaptureRow
            label="ID back"
            hint="Optional, but recommended"
            uploaded={session.backUploaded}
            uploading={uploading === 'back'}
            onClick={() => backInputRef.current?.click()}
            data-testid="phone-snap-back"
          />

          <input
            ref={frontInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            onChange={(e) => void handleUpload('front', e.currentTarget.files?.[0] ?? null)}
          />
          <input
            ref={backInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            onChange={(e) => void handleUpload('back', e.currentTarget.files?.[0] ?? null)}
          />

          {isComplete ? (
            <Alert color="green" variant="light" icon={<ShieldCheck size={17} />}>
              <Text size="sm" fw={700}>All set!</Text>
              <Text size="xs" c="#166534">You can now hand the phone back to the receptionist.</Text>
            </Alert>
          ) : null}

          <Text c="#94a3b8" ta="center" size="xs" mt={4}>
            Link expires in 30 minutes · Secure single-use session
          </Text>
        </Stack>
      </Card>
    </Box>
  );
}

function CaptureRow({
  label,
  hint,
  uploaded,
  uploading,
  onClick,
  ...rest
}: {
  label: string;
  hint: string;
  uploaded: boolean;
  uploading: boolean;
  onClick: () => void;
  [key: string]: unknown;
}) {
  return (
    <Card
      radius={radius.md}
      p={16}
      style={{
        background: uploaded ? '#f0fdf4' : '#ffffff',
        border: `1px solid ${uploaded ? '#86efac' : '#e2e8f0'}`,
      }}
      {...rest}
    >
      <Group justify="space-between" align="center">
        <Stack gap={2}>
          <Group gap={8}>
            <Text fw={700} c="#101828">{label}</Text>
            {uploaded ? <Badge color="green" leftSection={<Check size={11} />}>Sent</Badge> : null}
          </Group>
          <Text c="#64748b" size="xs">{hint}</Text>
        </Stack>
        <Button
          onClick={onClick}
          loading={uploading}
          color={uploaded ? 'gray' : 'stayosBrand'}
          variant={uploaded ? 'light' : 'filled'}
          size="md"
          leftSection={<Camera size={16} />}
        >
          {uploaded ? 'Retake' : 'Snap'}
        </Button>
      </Group>
    </Card>
  );
}
