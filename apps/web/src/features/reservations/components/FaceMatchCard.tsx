'use client';

import { useEffect, useRef, useState } from 'react';
import { Badge, Box, Button, Group, Loader, Paper, Stack, Text, ThemeIcon } from '@mantine/core';
import { Camera, RotateCcw, ShieldCheck, Video, VideoOff } from 'lucide-react';
import { radius, spacing } from '@stayos/theme';
import { showToast } from '@stayos/ui';
import { uploadCheckInDocument } from '../../../lib/reservation-api';

export type FaceCaptureProps = {
  idPhotoUrl?: string;
  compact?: boolean;
  // The persisted snap URL (from workspace documents). Shown as the initial snapshot state.
  persistedSnapUrl?: string;
  // When provided, the snap will be uploaded to the backend as a GUEST_FACE document.
  propertyId?: string;
  reservationId?: string;
  onSaved?: () => void;
  onCapture?: (dataUrl: string) => void;
};

/**
 * Live webcam capture card. Renders side-by-side with the ID photo so the
 * receptionist can eyeball a face match. When propertyId + reservationId are
 * provided, the snap is auto-persisted to the guest's document folder.
 */
export function FaceMatchCard({ idPhotoUrl, compact = false, persistedSnapUrl, propertyId, reservationId, onCapture, onSaved }: FaceCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [snapshot, setSnapshot] = useState<string | undefined>(persistedSnapUrl);
  const [isStarting, setIsStarting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState<boolean>(Boolean(persistedSnapUrl));
  const [error, setError] = useState<string | undefined>(undefined);

  // Sync when the parent reloads the workspace and gets a fresh persisted URL.
  useEffect(() => {
    if (persistedSnapUrl) {
      setSnapshot(persistedSnapUrl);
      setSaved(true);
    }
  }, [persistedSnapUrl]);

  const startCamera = async () => {
    setError(undefined);
    setIsStarting(true);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play().catch(() => undefined);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Camera unavailable';
      setError(message);
      showToast({ color: 'red', title: 'Camera blocked', message: 'Please allow camera access in your browser.' });
    } finally {
      setIsStarting(false);
    }
  };

  const stopCamera = () => {
    if (stream) stream.getTracks().forEach((t) => t.stop());
    setStream(null);
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  const persistSnap = async (dataUrl: string) => {
    if (!propertyId || !reservationId) return;
    setIsSaving(true);
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], 'guest-face.jpg', { type: 'image/jpeg' });
      await uploadCheckInDocument(propertyId, reservationId, 'guest_face', file);
      setSaved(true);
      showToast({ color: 'green', title: 'Face snap saved', message: 'Guest photo added to their document folder.' });
      onSaved?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save snap';
      showToast({ color: 'red', title: 'Save failed', message });
    } finally {
      setIsSaving(false);
    }
  };

  const snap = () => {
    if (!videoRef.current || !stream) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setSnapshot(dataUrl);
    setSaved(false);
    onCapture?.(dataUrl);
    stopCamera();
    void persistSnap(dataUrl);
  };

  const retake = () => {
    setSnapshot(undefined);
    setSaved(false);
    void startCamera();
  };

  useEffect(() => {
    return () => {
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, [stream]);

  const tileStyle: React.CSSProperties = {
    background: '#0f172a',
    border: '1px solid #1e293b',
    borderRadius: radius.md,
    minHeight: compact ? 150 : 220,
    overflow: 'hidden',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  return (
    <Paper
      radius={radius.lg}
      p={16}
      style={{
        background: 'linear-gradient(180deg,#ffffff 0%,#fbfdff 100%)',
        border: '1px solid rgba(226,232,240,0.78)',
        boxShadow: '0 14px 34px rgba(15,23,42,0.04)',
      }}
      data-testid="face-match-card"
    >
      <Group justify="space-between" align="center" mb={12}>
        <Group gap={10}>
          <ThemeIcon color="stayosBrand" variant="light" radius={radius.md} size={30}><Camera size={16} /></ThemeIcon>
          <Text fw={800} c="#101828">Face match</Text>
          {saved ? (
            <Badge color="green" variant="light" leftSection={<ShieldCheck size={11} />}>Saved</Badge>
          ) : null}
          {isSaving ? (
            <Badge color="blue" variant="light" leftSection={<Loader size={10} color="blue" />}>Saving…</Badge>
          ) : null}
        </Group>
        <Text c="#64748b" size="xs">Snap the guest to compare with the ID photo — saved automatically.</Text>
      </Group>

      <Group grow gap={spacing[3]} align="stretch">
        {/* ID PHOTO */}
        <Stack gap={6}>
          <Text size="xs" fw={700} c="#64748b">ID PHOTO</Text>
          <Box style={tileStyle}>
            {idPhotoUrl ? (
              <Box component="img" src={idPhotoUrl} alt="ID photo" style={{ maxWidth: '100%', maxHeight: compact ? 150 : 220, objectFit: 'contain' }} />
            ) : (
              <Stack align="center" gap={6}>
                <ThemeIcon size={44} radius="xl" color="gray" variant="light"><Camera size={22} /></ThemeIcon>
                <Text size="xs" c="#94a3b8">Upload ID front first</Text>
              </Stack>
            )}
          </Box>
        </Stack>

        {/* GUEST SNAP */}
        <Stack gap={6}>
          <Text size="xs" fw={700} c="#64748b">GUEST</Text>
          <Box style={tileStyle}>
            {snapshot ? (
              <Box component="img" src={snapshot} alt="Guest snapshot" style={{ maxWidth: '100%', maxHeight: compact ? 150 : 220, objectFit: 'contain' }} />
            ) : stream ? (
              <Box
                component="video"
                ref={videoRef}
                autoPlay
                muted
                playsInline
                style={{ width: '100%', height: compact ? 150 : 220, objectFit: 'cover', transform: 'scaleX(-1)' }}
              />
            ) : (
              <Stack align="center" gap={6}>
                <ThemeIcon size={44} radius="xl" color="gray" variant="light"><Video size={22} /></ThemeIcon>
                <Text size="xs" c="#94a3b8">{error ?? 'Camera off'}</Text>
              </Stack>
            )}
          </Box>
        </Stack>
      </Group>

      <Group justify="flex-end" mt={12} gap={8}>
        {snapshot ? (
          <Button variant="light" color="stayosBrand" leftSection={<RotateCcw size={14} />} onClick={retake} data-testid="face-retake">Retake</Button>
        ) : stream ? (
          <>
            <Button variant="subtle" color="gray" leftSection={<VideoOff size={14} />} onClick={stopCamera}>Stop</Button>
            <Button color="stayosBrand" leftSection={<Camera size={14} />} onClick={snap} data-testid="face-snap">Snap guest</Button>
          </>
        ) : (
          <Button color="stayosBrand" leftSection={<Video size={14} />} loading={isStarting} onClick={() => void startCamera()} data-testid="face-start">Start camera</Button>
        )}
      </Group>
    </Paper>
  );
}
