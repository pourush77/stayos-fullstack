'use client';

import { useParams } from 'next/navigation';
import {
  Alert,
  Box,
  Button,
  FileButton,
  Group,
  Image,
  LoadingOverlay,
  Paper,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { showToast } from '@stayos/ui';
import { Camera, CheckCircle2, RefreshCw, Send, Upload } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  ApiRequestError,
  getCaptureSession,
  getString,
  submitCapture,
  submitCaptureSide,
  type MobileCaptureDto,
} from '../../../features/check-in/check-in-api';
import { API_BASE_URL } from '../../../lib/api-base';

type CaptureSide = 'front' | 'back';
type CapturePageState = 'loading' | 'ready' | 'expired' | 'invalid' | 'network-error';

const LOOKUP_TIMEOUT_MS = 10_000;

function debugCapture(message: string, value: unknown) {
  if (process.env.NODE_ENV === 'development') console.info(message, value);
}

function stateForLookupError(error: unknown): CapturePageState {
  if (error instanceof ApiRequestError) {
    if (error.code === 'MOBILE_CAPTURE_EXPIRED') return 'expired';
    if (error.code === 'MOBILE_CAPTURE_INVALID' || error.status === 400 || error.status === 404) return 'invalid';
  }
  return 'network-error';
}

export default function CheckInCapturePage() {
  const params = useParams<{ token: string }>();
  const rawToken = params.token;
  const token = typeof rawToken === 'string' ? rawToken.trim() : '';
  const [session, setSession] = useState<MobileCaptureDto | null>(null);
  const [front, setFront] = useState<File | null>(null);
  const [back, setBack] = useState<File | null>(null);
  const [uploading, setUploading] = useState<CaptureSide | null>(null);
  const [error, setError] = useState('');
  const [pageState, setPageState] = useState<CapturePageState>('loading');
  const [retryNonce, setRetryNonce] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const status = getString(session ?? undefined, ['status']).toUpperCase();
  const expired = pageState === 'expired';
  const invalid = pageState === 'invalid';
  const networkError = pageState === 'network-error';
  const completed = sent || status === 'COMPLETED';
  const guestName = getString(session ?? undefined, ['guestDisplayName'], 'Guest');
  const reservationRef = getString(session ?? undefined, ['reservationReference']);
  const expiresAt = getString(session ?? undefined, ['expiresAt']);
  const frontPreview = useMemo(() => (front ? URL.createObjectURL(front) : ''), [front]);
  const backPreview = useMemo(() => (back ? URL.createObjectURL(back) : ''), [back]);

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);
    async function load() {
      debugCapture('Mobile capture API base:', API_BASE_URL);
      debugCapture('Capture token present:', Boolean(token));
      setPageState('loading');
      setError('');
      setSession(null);
      try {
        if (!token) {
          if (mounted) setPageState('invalid');
          return;
        }
        const nextSession = await getCaptureSession(token, controller.signal);
        if (!mounted) return;
        const nextStatus = getString(nextSession, ['status']).toUpperCase();
        setSession(nextSession);
        setPageState(['EXPIRED', 'REVOKED', 'CANCELLED', 'CANCELED'].includes(nextStatus) ? 'expired' : 'ready');
      } catch (lookupError) {
        if (!mounted) return;
        setPageState(stateForLookupError(lookupError));
      } finally {
        window.clearTimeout(timeoutId);
      }
    }
    void load();
    return () => {
      mounted = false;
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [retryNonce, token]);

  useEffect(() => {
    debugCapture('Resolved capture page state:', pageState);
  }, [pageState]);

  useEffect(() => () => {
    if (frontPreview) URL.revokeObjectURL(frontPreview);
    if (backPreview) URL.revokeObjectURL(backPreview);
  }, [backPreview, frontPreview]);

  async function uploadSide(side: CaptureSide, file: File | null) {
    if (!file || pageState !== 'ready' || completed || uploading) return;
    setError('');
    if (side === 'front') setFront(file);
    if (side === 'back') setBack(file);
    setUploading(side);
    try {
      await submitCaptureSide(token, side === 'front' ? 'ID_FRONT' : 'ID_BACK', file);
      showToast({ color: 'green', title: 'Uploaded', message: `${side === 'front' ? 'Front' : 'Back'} image uploaded.` });
    } catch {
      if (side === 'front') setFront(null);
      if (side === 'back') setBack(null);
      setError('Document upload failed. Please try again.');
      showToast({ color: 'red', title: 'Upload failed', message: 'Document upload failed. Try again.' });
    } finally {
      setUploading(null);
    }
  }

  async function finish() {
    if (!front || !back || pageState !== 'ready' || submitting || completed) return;
    setError('');
    setSubmitting(true);
    try {
      await submitCapture(token);
      setSent(true);
    } catch {
      setError('Document upload failed. Please try again.');
      showToast({ color: 'red', title: 'Submit failed', message: 'Document upload failed. Try again.' });
    } finally {
      setSubmitting(false);
    }
  }

  function retryLookup() {
    if (pageState === 'loading') return;
    setPageState('loading');
    setRetryNonce((value) => value + 1);
  }

  return (
    <Box style={{ background: '#f8fafc', minHeight: '100vh', padding: 16, position: 'relative' }}>
      <LoadingOverlay visible={pageState === 'loading'} />
      <Stack maw={520} mx="auto" gap={18}>
        <Box pt={18}>
          <Text fw={900} c="#4f46e5">StayOS</Text>
          <Title order={1} c="#101828" mt={6} style={{ fontSize: 30, lineHeight: '36px' }}>
            {pageState === 'ready' || completed ? 'Capture Guest ID' : 'Checking session...'}
          </Title>
          <Text c="#64748b" mt={6} fw={600}>{guestName}</Text>
          {reservationRef ? <Text c="#64748b" size="sm">Reservation {reservationRef}</Text> : null}
          {expiresAt ? <Text c="#64748b" size="sm">Expires {new Date(expiresAt).toLocaleString()}</Text> : null}
        </Box>

        {pageState === 'loading' ? (
          <Paper p={24} radius="md" bg="white" style={{ border: '1px solid #e2e8f0' }}>
            <Text c="#64748b" fw={600}>Checking session...</Text>
          </Paper>
        ) : expired ? (
          <Alert color="red" title="This capture link has expired.">
            Ask the receptionist to generate a new QR code.
          </Alert>
        ) : invalid ? (
          <Alert color="red" title="This capture link is not valid.">
            Ask the receptionist to generate a new QR code.
          </Alert>
        ) : networkError ? (
          <Alert color="red" title="Unable to open this capture session.">
            <Stack gap="sm">
              <Text size="sm">Make sure this phone and the hotel computer are connected to the same Wi-Fi.</Text>
              <Button
                leftSection={<RefreshCw size={18} />}
                onClick={retryLookup}
                variant="light"
              >
                Retry
              </Button>
            </Stack>
          </Alert>
        ) : completed ? (
          <Paper p={24} radius="md" bg="#f0fdf4" style={{ border: '1px solid #bbf7d0' }}>
            <Stack align="center" ta="center">
              <CheckCircle2 size={44} color="#16a34a" />
              <Title order={2} c="#166534">Document sent to the front desk.</Title>
            </Stack>
          </Paper>
        ) : (
          <Stack gap={14}>
            {error ? <Alert color="red">{error}</Alert> : null}
            <Paper p={14} radius="md" bg="white" style={{ border: '1px solid #e2e8f0' }}>
              <Stack gap={12}>
                <Text fw={800}>Front</Text>
                {frontPreview ? <Image src={frontPreview} alt="Front preview" radius="md" mah={260} fit="contain" /> : null}
                <Group grow>
                  <FileButton onChange={(file) => void uploadSide('front', file)} accept="image/*" capture="environment">
                    {(props) => <Button {...props} size="lg" loading={uploading === 'front'} leftSection={<Camera size={18} />}>Capture Front</Button>}
                  </FileButton>
                  <FileButton onChange={(file) => void uploadSide('front', file)} accept="image/*">
                    {(props) => <Button {...props} size="lg" variant="subtle" color="gray" leftSection={<Upload size={18} />}>Preview</Button>}
                  </FileButton>
                </Group>
                {front ? <Button size="lg" variant="light" color="gray" leftSection={<RefreshCw size={18} />} onClick={() => setFront(null)}>Retake</Button> : null}
              </Stack>
            </Paper>

            <Paper p={14} radius="md" bg="white" style={{ border: '1px solid #e2e8f0' }}>
              <Stack gap={12}>
                <Text fw={800}>Back</Text>
                {backPreview ? <Image src={backPreview} alt="Back preview" radius="md" mah={260} fit="contain" /> : null}
                <Group grow>
                  <FileButton onChange={(file) => void uploadSide('back', file)} accept="image/*" capture="environment">
                    {(props) => <Button {...props} size="lg" variant="light" loading={uploading === 'back'} leftSection={<Camera size={18} />}>Capture Back</Button>}
                  </FileButton>
                  <FileButton onChange={(file) => void uploadSide('back', file)} accept="image/*">
                    {(props) => <Button {...props} size="lg" variant="subtle" color="gray" leftSection={<Upload size={18} />}>Preview</Button>}
                  </FileButton>
                </Group>
                {back ? <Button size="lg" variant="light" color="gray" leftSection={<RefreshCw size={18} />} onClick={() => setBack(null)}>Retake</Button> : null}
              </Stack>
            </Paper>

            <Button size="lg" leftSection={<Send size={18} />} onClick={finish} loading={submitting} disabled={!front || !back || Boolean(uploading)}>
              Submit
            </Button>
          </Stack>
        )}
      </Stack>
    </Box>
  );
}
